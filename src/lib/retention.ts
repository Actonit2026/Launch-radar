import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { planViewFromUser } from "@/lib/plans";

type Supabase = SupabaseClient<Database>;

function retentionLimit(planName: "free" | "pro" | "business") {
  if (planName === "business") {
    return 60;
  }

  return planName === "pro" ? 30 : 15;
}

async function deleteOldSnapshotsForPage({
  supabase,
  monitoredPageId,
  keep,
}: {
  supabase: Supabase;
  monitoredPageId: string;
  keep: number;
}) {
  const { data, error } = await supabase
    .from("snapshots")
    .select("id, created_at")
    .eq("monitored_page_id", monitoredPageId)
    .order("created_at", { ascending: false });

  if (error) {
    return { deleted: 0, error: error.message };
  }

  const idsToDelete = (data ?? []).slice(keep).map((snapshot) => snapshot.id);

  if (!idsToDelete.length) {
    return { deleted: 0 };
  }

  const { error: deleteError } = await supabase
    .from("snapshots")
    .delete()
    .in("id", idsToDelete);

  return {
    deleted: deleteError ? 0 : idsToDelete.length,
    error: deleteError?.message,
  };
}

async function deleteOldProductSnapshots({
  supabase,
  userId,
  keep,
}: {
  supabase: Supabase;
  userId: string;
  keep: number;
}) {
  const { data, error } = await supabase
    .from("product_snapshots")
    .select("id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return { deleted: 0, error: error.message };
  }

  const idsToDelete = (data ?? []).slice(keep).map((snapshot) => snapshot.id);

  if (!idsToDelete.length) {
    return { deleted: 0 };
  }

  const { error: deleteError } = await supabase
    .from("product_snapshots")
    .delete()
    .in("id", idsToDelete);

  return {
    deleted: deleteError ? 0 : idsToDelete.length,
    error: deleteError?.message,
  };
}

export async function cleanupSnapshotRetentionForUser({
  supabase,
  userId,
}: {
  supabase: Supabase;
  userId: string;
}) {
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select(
      "plan, competitor_limit, scan_interval_hours, subscription_status, current_period_end",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return { deleted: 0, errors: [profileError.message] };
  }

  const keep = retentionLimit(planViewFromUser(profile).name);
  const { data: competitors, error: competitorsError } = await supabase
    .from("competitors")
    .select("id")
    .eq("user_id", userId);

  if (competitorsError) {
    return { deleted: 0, errors: [competitorsError.message] };
  }

  const competitorIds = (competitors ?? []).map((competitor) => competitor.id);
  const { data: pages, error: pagesError } = competitorIds.length
    ? await supabase
        .from("monitored_pages")
        .select("id")
        .in("competitor_id", competitorIds)
    : { data: [], error: null };

  if (pagesError) {
    return { deleted: 0, errors: [pagesError.message] };
  }

  let deleted = 0;
  const errors: string[] = [];

  for (const page of pages ?? []) {
    const result = await deleteOldSnapshotsForPage({
      supabase,
      monitoredPageId: page.id,
      keep,
    });

    deleted += result.deleted;

    if (result.error) {
      errors.push(result.error);
    }
  }

  const productCleanup = await deleteOldProductSnapshots({
    supabase,
    userId,
    keep,
  });

  deleted += productCleanup.deleted;

  if (productCleanup.error) {
    errors.push(productCleanup.error);
  }

  return { deleted, errors };
}
