import { NextResponse } from "next/server";
import { aiSummariesEnabled } from "@/lib/ai/config";
import { scanQueueEnabled } from "@/lib/scan-queue";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function databaseStatus() {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "not_configured";
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .limit(1);

    return error ? "unreachable" : "reachable";
  } catch {
    return "unreachable";
  }
}

export async function GET() {
  const db = await databaseStatus();
  const healthy = db === "reachable" || db === "not_configured";

  return NextResponse.json(
    {
      ok: healthy,
      app: "alive",
      database: db,
      queue: scanQueueEnabled() ? "enabled" : "inline_scanner",
      scan_worker: scanQueueEnabled() ? "cron_endpoint" : "inline_scanner",
      ai_fallback: aiSummariesEnabled() ? "ai_optional" : "deterministic_only",
    },
    { status: healthy ? 200 : 503 },
  );
}
