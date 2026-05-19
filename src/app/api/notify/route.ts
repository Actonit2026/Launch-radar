import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/api-auth";
import { sendDetectedChangeNotification } from "@/lib/notifications";
import {
  isSupabaseConfigured,
  supabaseConfigMessage,
} from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: supabaseConfigMessage }, { status: 500 });
  }

  const context = await getAuthenticatedContext(request);

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    changeId?: unknown;
  } | null;
  const changeId = typeof body?.changeId === "string" ? body.changeId : "";

  if (!changeId) {
    return NextResponse.json(
      { error: "changeId is required." },
      { status: 400 },
    );
  }

  const result = await sendDetectedChangeNotification({
    supabase: context.supabase,
    userId: context.user.id,
    changeId,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result.data);
}
