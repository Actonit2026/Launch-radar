import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ScanJob } from "@/lib/database.types";
import { planViewFromUser } from "@/lib/plans";
import { scanMonitoredPagesForUser } from "@/lib/scanner";

type Supabase = SupabaseClient<Database>;

function retryAvailableAt(attempts: number) {
  const delayMinutes = Math.min(60, Math.max(1, attempts) * 5);

  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

export function scanQueueEnabled() {
  return process.env.ASYNC_SCAN_QUEUE_ENABLED === "1";
}

export async function enqueueManualScan({
  supabase,
  userId,
}: {
  supabase: Supabase;
  userId: string;
}) {
  const { data: profile } = await supabase
    .from("users")
    .select(
      "plan, competitor_limit, scan_interval_hours, subscription_status, current_period_end",
    )
    .eq("id", userId)
    .maybeSingle();
  const plan = planViewFromUser(profile);
  const priority = plan.name === "pro" ? 100 : 50;
  const dedupeKey = `${userId}:manual_scan`;
  const { data: existing } = await supabase
    .from("scan_jobs")
    .select("*")
    .eq("dedupe_key", dedupeKey)
    .in("status", ["queued", "running", "deferred"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { job: existing, created: false };
  }

  const { data: job, error } = await supabase
    .from("scan_jobs")
    .insert({
      user_id: userId,
      job_type: "manual_scan",
      status: "queued",
      priority,
      dedupe_key: dedupeKey,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { job, created: true };
}

export async function processNextScanJob(supabase: Supabase) {
  const { data: job, error } = await supabase
    .from("scan_jobs")
    .select("*")
    .in("status", ["queued", "deferred"])
    .lte("available_at", new Date().toISOString())
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!job) {
    return { processed: false, job: null as ScanJob | null };
  }

  const now = new Date().toISOString();
  await supabase
    .from("scan_jobs")
    .update({
      status: "running",
      attempts: job.attempts + 1,
      started_at: now,
      updated_at: now,
    })
    .eq("id", job.id);

  const result = await scanMonitoredPagesForUser(supabase, job.user_id);
  const completedAt = new Date().toISOString();

  if (result.error) {
    const failedPermanently = job.attempts + 1 >= 3;
    await supabase
      .from("scan_jobs")
      .update({
        status: failedPermanently ? "failed" : "deferred",
        last_error: result.error,
        available_at: failedPermanently
          ? job.available_at
          : retryAvailableAt(job.attempts + 1),
        completed_at: failedPermanently ? completedAt : null,
        updated_at: completedAt,
      })
      .eq("id", job.id);

    return {
      processed: true,
      job,
      status: failedPermanently ? "failed" : "deferred",
      error: result.error,
    };
  }

  await supabase
    .from("scan_jobs")
    .update({
      status: "completed",
      completed_at: completedAt,
      updated_at: completedAt,
      last_error: null,
    })
    .eq("id", job.id);

  return { processed: true, job, status: "completed", result: result.data };
}
