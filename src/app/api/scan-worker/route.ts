import { NextResponse } from "next/server";
import { processNextScanJob } from "@/lib/scan-queue";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processNextScanJob(getSupabaseAdminClient());

  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return POST(request);
}
