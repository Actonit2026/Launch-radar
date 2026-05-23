import type { User } from "@supabase/supabase-js";
import type {
  Competitor,
  CompetitorIntelligenceSnapshot,
  DetectedChange,
  MonitoredPage,
  ScanDebugLog,
} from "@/lib/database.types";
import { formatDatabaseError } from "@/lib/errors";
import { formatPageOrder } from "@/lib/format";
import {
  parseIntelligenceSnapshot,
  type IntelligenceSnapshotView,
} from "@/lib/intelligence/display";
import {
  parseScanDebugLog,
  type ScanDebugLogView,
} from "@/lib/scan-debug";
import { ensureUserProfile } from "@/lib/profiles";
import { isMasterAdminEmail } from "@/lib/master-admin";
import { planViewFromUser, type UserPlanView } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";

export type DashboardCompetitor = Competitor & {
  monitoredPages: MonitoredPage[];
  changeCount: number;
  latestChange: RecentChange | null;
  lastCheckedAt: string | null;
  latestIntelligence: IntelligenceSnapshotView | null;
};

export type RecentChange = DetectedChange & {
  page: MonitoredPage;
  competitor: Competitor;
};

export type DashboardData = {
  competitors: DashboardCompetitor[];
  recentChanges: RecentChange[];
  plan: UserPlanView & {
    competitorCount: number;
    masterAdmin: boolean;
  };
  stats: {
    competitors: number;
    trackedPages: number;
    changes: number;
  };
};

export type CompetitorDetail = {
  competitor: Competitor;
  pages: MonitoredPage[];
  changes: Array<DetectedChange & { page: MonitoredPage }>;
  latestIntelligence: IntelligenceSnapshotView | null;
  debugLogs: ScanDebugLogView[];
};

type DataResult<T> = {
  data: T | null;
  error?: string;
};

function sortPages(pages: MonitoredPage[]) {
  return [...pages].sort(
    (a, b) => formatPageOrder(a.page_type) - formatPageOrder(b.page_type),
  );
}

function isRecentChange(change: RecentChange | null): change is RecentChange {
  return Boolean(change);
}

function latestCheckedAt(pages: MonitoredPage[]) {
  const checkedDates = pages
    .map((page) => page.last_checked_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a));

  return checkedDates[0] ?? null;
}

function latestSnapshotsByCompetitor(
  snapshots: CompetitorIntelligenceSnapshot[],
) {
  const latestByCompetitor = new Map<string, CompetitorIntelligenceSnapshot>();

  for (const snapshot of snapshots) {
    if (!latestByCompetitor.has(snapshot.competitor_id)) {
      latestByCompetitor.set(snapshot.competitor_id, snapshot);
    }
  }

  return latestByCompetitor;
}

function parseDebugLogs(logs: ScanDebugLog[]) {
  return logs.map(parseScanDebugLog);
}

export async function getDashboardData(
  user: User,
): Promise<DataResult<DashboardData>> {
  const supabase = await createClient();
  const profileError = await ensureUserProfile(supabase, user);

  if (profileError) {
    return { data: null, error: profileError };
  }

  const { data: profile, error: profileQueryError } = await supabase
    .from("users")
    .select(
      "plan, competitor_limit, scan_interval_hours, subscription_status, current_period_end",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileQueryError) {
    return {
      data: null,
      error: formatDatabaseError(profileQueryError.message),
    };
  }

  const { data: competitors, error: competitorsError } = await supabase
    .from("competitors")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (competitorsError) {
    return { data: null, error: formatDatabaseError(competitorsError.message) };
  }

  const competitorRows = competitors ?? [];
  const competitorIds = competitorRows.map((competitor) => competitor.id);
  const { data: pages, error: pagesError } = competitorIds.length
    ? await supabase
        .from("monitored_pages")
        .select("*")
        .in("competitor_id", competitorIds)
    : { data: [], error: null };

  if (pagesError) {
    return { data: null, error: formatDatabaseError(pagesError.message) };
  }

  const pageRows = pages ?? [];
  const pageIds = pageRows.map((page) => page.id);
  const { data: changes, error: changesError } = pageIds.length
    ? await supabase
        .from("detected_changes")
        .select("*")
        .in("monitored_page_id", pageIds)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [], error: null };

  if (changesError) {
    return { data: null, error: formatDatabaseError(changesError.message) };
  }

  const { count: changeCount, error: changeCountError } = pageIds.length
    ? await supabase
        .from("detected_changes")
        .select("id", { count: "exact", head: true })
        .in("monitored_page_id", pageIds)
    : { count: 0, error: null };

  if (changeCountError) {
    return {
      data: null,
      error: formatDatabaseError(changeCountError.message),
    };
  }

  const { data: intelligenceSnapshots, error: intelligenceError } =
    competitorIds.length
      ? await supabase
          .from("competitor_intelligence_snapshots")
          .select("*")
          .in("competitor_id", competitorIds)
          .order("created_at", { ascending: false })
          .limit(100)
      : { data: [], error: null };

  if (intelligenceError) {
    return {
      data: null,
      error: formatDatabaseError(intelligenceError.message),
    };
  }

  const competitorById = new Map(
    competitorRows.map((competitor) => [competitor.id, competitor]),
  );
  const pageById = new Map(pageRows.map((page) => [page.id, page]));
  const pagesByCompetitor = new Map<string, MonitoredPage[]>();
  const latestIntelligenceByCompetitor = latestSnapshotsByCompetitor(
    intelligenceSnapshots ?? [],
  );

  for (const page of pageRows) {
    const group = pagesByCompetitor.get(page.competitor_id) ?? [];
    group.push(page);
    pagesByCompetitor.set(page.competitor_id, group);
  }

  const recentChanges = (changes ?? [])
    .map((change) => {
      const page = pageById.get(change.monitored_page_id);

      if (!page) {
        return null;
      }

      const competitor = competitorById.get(page.competitor_id);

      if (!competitor) {
        return null;
      }

      return { ...change, page, competitor };
    })
    .filter(isRecentChange);

  const competitorsWithPages = competitorRows.map((competitor) => {
    const monitoredPages = sortPages(
      pagesByCompetitor.get(competitor.id) ?? [],
    );
    const latestChange =
      recentChanges.find(
        (change) => change.competitor.id === competitor.id,
      ) ?? null;
    const competitorChangeCount = recentChanges.filter(
      (change) => change.competitor.id === competitor.id,
    ).length;

    return {
      ...competitor,
      monitoredPages,
      latestChange,
      changeCount: competitorChangeCount,
      lastCheckedAt: latestCheckedAt(monitoredPages),
      latestIntelligence: parseIntelligenceSnapshot(
        latestIntelligenceByCompetitor.get(competitor.id),
      ),
    };
  });

  const basePlan = planViewFromUser(profile);
  const masterAdmin = isMasterAdminEmail(user.email);

  return {
    data: {
      competitors: competitorsWithPages,
      recentChanges,
      plan: {
        ...basePlan,
        label: masterAdmin ? "Master admin" : basePlan.label,
        competitorLimit: masterAdmin ? 999 : basePlan.competitorLimit,
        competitorCount: competitorRows.length,
        masterAdmin,
      },
      stats: {
        competitors: competitorRows.length,
        trackedPages: pageRows.length,
        changes: changeCount ?? 0,
      },
    },
  };
}

export async function getCompetitorDetail(
  user: User,
  competitorId: string,
): Promise<DataResult<CompetitorDetail>> {
  const supabase = await createClient();
  const profileError = await ensureUserProfile(supabase, user);

  if (profileError) {
    return { data: null, error: profileError };
  }

  const { data: competitor, error: competitorError } = await supabase
    .from("competitors")
    .select("*")
    .eq("id", competitorId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (competitorError) {
    return { data: null, error: formatDatabaseError(competitorError.message) };
  }

  if (!competitor) {
    return { data: null };
  }

  const { data: pages, error: pagesError } = await supabase
    .from("monitored_pages")
    .select("*")
    .eq("competitor_id", competitor.id);

  if (pagesError) {
    return { data: null, error: formatDatabaseError(pagesError.message) };
  }

  const pageRows = sortPages(pages ?? []);
  const pageIds = pageRows.map((page) => page.id);
  const { data: changes, error: changesError } = pageIds.length
    ? await supabase
        .from("detected_changes")
        .select("*")
        .in("monitored_page_id", pageIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (changesError) {
    return { data: null, error: formatDatabaseError(changesError.message) };
  }

  const pageById = new Map(pageRows.map((page) => [page.id, page]));
  const changesWithPages = (changes ?? [])
    .map((change) => {
      const page = pageById.get(change.monitored_page_id);
      return page ? { ...change, page } : null;
    })
    .filter(
      (
        change,
      ): change is DetectedChange & {
        page: MonitoredPage;
      } => Boolean(change),
    );

  const { data: intelligenceSnapshot, error: intelligenceError } = await supabase
    .from("competitor_intelligence_snapshots")
    .select("*")
    .eq("competitor_id", competitor.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (intelligenceError) {
    return { data: null, error: formatDatabaseError(intelligenceError.message) };
  }

  const { data: debugLogs, error: debugLogsError } = await supabase
    .from("scan_debug_logs")
    .select("*")
    .eq("competitor_id", competitor.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (debugLogsError) {
    return { data: null, error: formatDatabaseError(debugLogsError.message) };
  }

  return {
    data: {
      competitor,
      pages: pageRows,
      changes: changesWithPages,
      latestIntelligence: parseIntelligenceSnapshot(intelligenceSnapshot),
      debugLogs: parseDebugLogs(debugLogs ?? []),
    },
  };
}
