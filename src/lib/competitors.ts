import type { User } from "@supabase/supabase-js";
import type { Competitor, DetectedChange, MonitoredPage } from "@/lib/database.types";
import { formatDatabaseError } from "@/lib/errors";
import { formatPageOrder } from "@/lib/format";
import { ensureUserProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

export type DashboardCompetitor = Competitor & {
  monitoredPages: MonitoredPage[];
  changeCount: number;
  latestChange: RecentChange | null;
};

export type RecentChange = DetectedChange & {
  page: MonitoredPage;
  competitor: Competitor;
};

export type DashboardData = {
  competitors: DashboardCompetitor[];
  recentChanges: RecentChange[];
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

export async function getDashboardData(
  user: User,
): Promise<DataResult<DashboardData>> {
  const supabase = await createClient();
  const profileError = await ensureUserProfile(supabase, user);

  if (profileError) {
    return { data: null, error: profileError };
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

  const competitorById = new Map(
    competitorRows.map((competitor) => [competitor.id, competitor]),
  );
  const pageById = new Map(pageRows.map((page) => [page.id, page]));
  const pagesByCompetitor = new Map<string, MonitoredPage[]>();

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
    };
  });

  return {
    data: {
      competitors: competitorsWithPages,
      recentChanges,
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

  return {
    data: {
      competitor,
      pages: pageRows,
      changes: changesWithPages,
    },
  };
}
