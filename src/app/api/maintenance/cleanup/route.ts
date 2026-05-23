import { NextResponse } from "next/server";
import { cleanupSnapshotRetentionForUser } from "@/lib/retention";
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

async function runCleanup(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: users, error } = await supabase.from("users").select("id");

  if (error) {
    return NextResponse.json(
      { error: "Could not load users for cleanup." },
      { status: 500 },
    );
  }

  let deleted = 0;
  const errors: string[] = [];

  for (const user of users ?? []) {
    const result = await cleanupSnapshotRetentionForUser({
      supabase,
      userId: user.id,
    });

    deleted += result.deleted;
    errors.push(...result.errors);
  }

  return NextResponse.json({
    users: users?.length ?? 0,
    deleted,
    errors: errors.slice(0, 10),
  });
}

export async function POST(request: Request) {
  return runCleanup(request);
}

export async function GET(request: Request) {
  return runCleanup(request);
}
