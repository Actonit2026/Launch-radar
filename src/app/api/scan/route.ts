import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { enqueueManualScan, scanQueueEnabled } from "@/lib/scan-queue";
import { scanMonitoredPagesForUser } from "@/lib/scanner";
import {
  isSupabaseConfigured,
  supabaseConfigMessage,
} from "@/lib/supabase/config";
import { canRunManualScan, USAGE_DEFERRED_MESSAGE } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function runScan(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: supabaseConfigMessage },
        { status: 500 },
      );
    }

    const context = await getAuthenticatedContext(request);

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const guard = await canRunManualScan({
      supabase: context.supabase,
      userId: context.user.id,
    });

    if (!guard.allowed) {
      return NextResponse.json(
        {
          error: guard.reason ?? USAGE_DEFERRED_MESSAGE,
          deferred: true,
        },
        { status: 429 },
      );
    }

    if (scanQueueEnabled()) {
      const queued = await enqueueManualScan({
        supabase: context.supabase,
        userId: context.user.id,
      });

      return NextResponse.json(
        {
          queued: true,
          status: queued.job.status,
          jobId: queued.job.id,
          message: queued.created
            ? "Scan queued. It will run shortly."
            : "Scan already queued.",
        },
        { status: 202 },
      );
    }

    const result = await scanMonitoredPagesForUser(
      context.supabase,
      context.user.id,
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Scan failed", error);

    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return runScan(request);
}

export async function POST(request: Request) {
  return runScan(request);
}
