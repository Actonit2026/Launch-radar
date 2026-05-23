import { NextResponse } from "next/server";
import { scanMonitoredPagesForUser } from "@/lib/scanner";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { canRunScheduledScan, USAGE_DEFERRED_MESSAGE } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function scheduledUserLimit() {
  const value = Number(process.env.SCHEDULED_SCAN_USER_LIMIT);

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 25;
}

async function runScheduledScans(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(scheduledUserLimit());

  if (error) {
    return NextResponse.json(
      { error: "Could not load users for scheduled scans." },
      { status: 500 },
    );
  }

  let processed = 0;
  let skipped = 0;
  let checked = 0;
  let failed = 0;
  let changesCreated = 0;
  const errors: string[] = [];

  for (const user of users ?? []) {
    const guard = await canRunScheduledScan({
      supabase,
      userId: user.id,
    });

    if (!guard.allowed) {
      skipped += 1;
      errors.push(guard.reason ?? USAGE_DEFERRED_MESSAGE);
      continue;
    }

    const result = await scanMonitoredPagesForUser(supabase, user.id, {
      usageEventType: "scheduled_scan",
      recordZeroUsage: false,
    });

    if (result.error || !result.data) {
      failed += 1;
      errors.push(result.error ?? "Scheduled scan failed.");
      continue;
    }

    processed += 1;
    checked += result.data.checked;
    failed += result.data.failed;
    changesCreated += result.data.changesCreated;
  }

  return NextResponse.json({
    users: users?.length ?? 0,
    processed,
    skipped,
    checked,
    failed,
    changesCreated,
    errors: Array.from(new Set(errors)).slice(0, 10),
  });
}

export async function GET(request: Request) {
  return runScheduledScans(request);
}

export async function POST(request: Request) {
  return runScheduledScans(request);
}
