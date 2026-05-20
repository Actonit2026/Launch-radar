import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { scanMonitoredPagesForUser } from "@/lib/scanner";
import {
  isSupabaseConfigured,
  supabaseConfigMessage,
} from "@/lib/supabase/config";

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

    const result = await scanMonitoredPagesForUser(
      context.supabase,
      context.user.id,
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed.";

    console.error("Scan failed", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return runScan(request);
}

export async function POST(request: Request) {
  return runScan(request);
}
