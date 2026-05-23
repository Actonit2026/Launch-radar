"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  createInitialMonitoringSetup,
  rerunCompetitorIntelligence,
} from "@/lib/scanner";
import {
  isManualPageType,
  parseCompetitorUrl,
  parseManualPageUrl,
} from "@/lib/urls";
import { ensureUserProfile } from "@/lib/profiles";
import { isAtCompetitorLimit, planViewFromUser } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import {
  isSupabaseConfigured,
  supabaseConfigMessage,
} from "@/lib/supabase/config";
import { canRunManualAnalysis, recordUsageEvent } from "@/lib/usage";
import { isMasterAdminEmail } from "@/lib/master-admin";

export type CompetitorFormState = {
  error?: string;
  message?: string;
};

export type ManualPageFormState = {
  error?: string;
  message?: string;
};

type ParsedCompetitorForm =
  | {
    name: string;
    baseUrl: string;
    submittedPageUrl?: string;
    error?: never;
  }
  | {
      error: string;
      name?: never;
      baseUrl?: never;
    };

function readCompetitorForm(formData: FormData): ParsedCompetitorForm {
  const rawName = String(formData.get("name") ?? "").trim();
  const rawUrl = String(formData.get("baseUrl") ?? "").trim();

  if (!rawUrl) {
    return { error: "Competitor URL is required." };
  }

  try {
    const parsedUrl = parseCompetitorUrl(rawUrl);
    const baseUrl = parsedUrl.baseUrl;
    const hostname = new URL(baseUrl).hostname.replace(/^www\./, "");
    const name = rawName || hostname;

    return {
      name,
      baseUrl,
      submittedPageUrl: parsedUrl.submittedPageUrl,
    };
  } catch {
    return { error: "Enter a valid website URL." };
  }
}

function isDuplicateError(code?: string) {
  return code === "23505";
}

async function getOwnedCompetitor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  competitorId: string,
) {
  if (!competitorId) {
    return { competitor: null, error: "Competitor is required." };
  }

  const { data: competitor, error } = await supabase
    .from("competitors")
    .select("id, name, base_url")
    .eq("id", competitorId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { competitor: null, error: error.message };
  }

  if (!competitor) {
    return { competitor: null, error: "Competitor not found." };
  }

  return { competitor, error: null };
}

export async function createCompetitorAction(
  _previousState: CompetitorFormState,
  formData: FormData,
): Promise<CompetitorFormState> {
  if (!isSupabaseConfigured()) {
    return { error: supabaseConfigMessage };
  }

  const user = await getCurrentUser();

  if (!user) {
    return { error: "Sign in before adding a competitor." };
  }

  const parsed = readCompetitorForm(formData);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const profileError = await ensureUserProfile(supabase, user);

  if (profileError) {
    return { error: profileError };
  }

  const [{ data: profile, error: profileQueryError }, { count, error: countError }] =
    await Promise.all([
      supabase
        .from("users")
        .select(
          "plan, competitor_limit, scan_interval_hours, subscription_status, current_period_end",
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("competitors")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

  if (profileQueryError) {
    return { error: profileQueryError.message };
  }

  if (countError) {
    return { error: countError.message };
  }

  const plan = planViewFromUser(profile);
  const competitorCount = count ?? 0;
  const masterAdmin = isMasterAdminEmail(user.email);

  if (!masterAdmin && isAtCompetitorLimit({ competitorCount, plan })) {
    return {
      error: `${plan.label} plan limit reached: ${competitorCount}/${plan.competitorLimit} competitors tracked. Upgrade to Pro to track up to 20 competitors.`,
    };
  }

  if (masterAdmin && isAtCompetitorLimit({ competitorCount, plan })) {
    await recordUsageEvent({
      supabase,
      userId: user.id,
      eventType: "master_admin_action",
      metadata: {
        action: "competitor_limit_bypass",
        competitor_count: competitorCount,
        plan: plan.name,
      },
    });
  }

  const { data: competitor, error: competitorError } = await supabase
    .from("competitors")
    .insert({
      user_id: user.id,
      name: parsed.name,
      base_url: parsed.baseUrl,
    })
    .select("id")
    .single();

  if (competitorError) {
    if (isDuplicateError(competitorError.code)) {
      return { error: "That competitor is already being tracked." };
    }

    return { error: competitorError.message };
  }

  const setup = await createInitialMonitoringSetup(
    supabase,
    competitor.id,
    parsed.baseUrl,
    {
      competitorName: parsed.name,
      submittedPageUrl: parsed.submittedPageUrl,
      userId: user.id,
    },
  );

  if (setup.error) {
    await supabase
      .from("competitors")
      .delete()
      .eq("id", competitor.id)
      .eq("user_id", user.id);

    return { error: setup.error };
  }

  await recordUsageEvent({
    supabase,
    userId: user.id,
    eventType: "first_competitor_added",
    metadata: {
      competitor_id: competitor.id,
    },
  });

  if (setup.data?.snapshotsCreated || setup.data?.intelligenceSnapshotCreated) {
    await recordUsageEvent({
      supabase,
      userId: user.id,
      eventType: "first_scan_completed",
      metadata: {
        competitor_id: competitor.id,
        snapshots_created: setup.data.snapshotsCreated,
        intelligence_snapshot_created: setup.data.intelligenceSnapshotCreated,
      },
    });
  }

  revalidatePath("/dashboard");

  const snapshotMessage = setup.data?.snapshotsCreated
    ? ` Created ${setup.data.snapshotsCreated} baseline snapshots.`
    : "";
  const intelligenceMessage = setup.data?.intelligenceSnapshotCreated
    ? " Snapshot ready."
    : "";

  return {
    message: `${parsed.name} is now tracked.${snapshotMessage}${intelligenceMessage}`,
  };
}

export async function deleteCompetitorAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const competitorId = String(formData.get("competitorId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");

  if (competitorId) {
    const supabase = await createClient();
    await supabase
      .from("competitors")
      .delete()
      .eq("id", competitorId)
      .eq("user_id", user.id);
  }

  revalidatePath("/dashboard");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
}

export async function addManualPageAction(
  _previousState: ManualPageFormState,
  formData: FormData,
): Promise<ManualPageFormState> {
  if (!isSupabaseConfigured()) {
    return { error: supabaseConfigMessage };
  }

  const user = await getCurrentUser();

  if (!user) {
    return { error: "Sign in before adding a page." };
  }

  const competitorId = String(formData.get("competitorId") ?? "");
  const rawPageType = String(formData.get("pageType") ?? "");
  const rawPageUrl = String(formData.get("pageUrl") ?? "");

  if (!isManualPageType(rawPageType)) {
    return { error: "Choose a valid page type." };
  }

  const supabase = await createClient();
  const profileError = await ensureUserProfile(supabase, user);

  if (profileError) {
    return { error: profileError };
  }

  const { competitor, error: competitorError } = await getOwnedCompetitor(
    supabase,
    user.id,
    competitorId,
  );

  if (competitorError || !competitor) {
    return { error: competitorError ?? "Competitor not found." };
  }

  let pageUrl: string;

  try {
    pageUrl = parseManualPageUrl(rawPageUrl, competitor.base_url);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Enter a valid page URL.",
    };
  }

  const { data: monitoredPage, error: pageError } = await supabase
    .from("monitored_pages")
    .upsert(
      {
        competitor_id: competitor.id,
        page_type: rawPageType,
        url: pageUrl,
        last_checked_at: null,
      },
      { onConflict: "competitor_id,page_type" },
    )
    .select("id")
    .single();

  if (pageError) {
    return { error: pageError.message };
  }

  const guard = await canRunManualAnalysis({
    supabase,
    userId: user.id,
  });

  if (!guard.allowed) {
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/competitors/${competitor.id}`);

    return {
      message: `Page saved. Re-analysis deferred: ${
        guard.reason ?? "usage limit reached"
      }`,
    };
  }

  const analysis = await rerunCompetitorIntelligence(supabase, {
    competitorId: competitor.id,
    competitorName: competitor.name,
    userId: user.id,
    baselinePageIds: monitoredPage ? [monitoredPage.id] : [],
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/competitors/${competitor.id}`);

  if (analysis.error) {
    return {
      error: `Page saved, but re-analysis failed: ${analysis.error}`,
    };
  }

  return {
    message: `Saved ${rawPageType} page and re-ran analysis. Snapshot ready.`,
  };
}

export async function rerunCompetitorIntelligenceAction(
  _previousState: ManualPageFormState,
  formData: FormData,
): Promise<ManualPageFormState> {
  if (!isSupabaseConfigured()) {
    return { error: supabaseConfigMessage };
  }

  const user = await getCurrentUser();

  if (!user) {
    return { error: "Sign in before re-running analysis." };
  }

  const competitorId = String(formData.get("competitorId") ?? "");
  const supabase = await createClient();
  const profileError = await ensureUserProfile(supabase, user);

  if (profileError) {
    return { error: profileError };
  }

  const { competitor, error: competitorError } = await getOwnedCompetitor(
    supabase,
    user.id,
    competitorId,
  );

  if (competitorError || !competitor) {
    return { error: competitorError ?? "Competitor not found." };
  }

  const guard = await canRunManualAnalysis({
    supabase,
    userId: user.id,
  });

  if (!guard.allowed) {
    return { error: guard.reason ?? "Re-analysis limit reached." };
  }

  const analysis = await rerunCompetitorIntelligence(supabase, {
    competitorId: competitor.id,
    competitorName: competitor.name,
    userId: user.id,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/competitors/${competitor.id}`);

  if (analysis.error) {
    return { error: analysis.error };
  }

  return {
    message: `Re-ran analysis across ${
      analysis.data?.pagesAnalyzed ?? 0
    } public pages. Snapshot ready.`,
  };
}
