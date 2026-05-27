import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { sendWeeklyDigestEmail } from "@/lib/email/resend";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { estimateScanCostEur, recordUsageEvent } from "@/lib/usage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function sevenDaysAgoIso() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

async function runWeeklyDigest(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const appUrl = getAppUrl(new Headers(request.headers));
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email")
    .not("email", "is", null);

  if (usersError) {
    return NextResponse.json(
      { error: "Could not load digest recipients." },
      { status: 500 },
    );
  }

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const user of users ?? []) {
    if (!user.email) {
      skipped += 1;
      continue;
    }

    const { data: competitors } = await supabase
      .from("competitors")
      .select("id, name")
      .eq("user_id", user.id);
    const competitorIds = (competitors ?? []).map((competitor) => competitor.id);
    const { data: pages } = competitorIds.length
      ? await supabase
          .from("monitored_pages")
          .select("id, competitor_id, page_type, url")
          .in("competitor_id", competitorIds)
      : { data: [] };
    const pageIds = (pages ?? []).map((page) => page.id);
    const { data: changes } = pageIds.length
      ? await supabase
          .from("detected_changes")
          .select("diff_summary, severity, monitored_page_id, created_at")
          .in("monitored_page_id", pageIds)
          .eq("analyzer_version", "v3")
          .eq("status", "active")
          .gte("confidence_score", 0.72)
          .gte("created_at", sevenDaysAgoIso())
          .order("created_at", { ascending: false })
      : { data: [] };
    const pageById = new Map((pages ?? []).map((page) => [page.id, page]));
    const competitorById = new Map(
      (competitors ?? []).map((competitor) => [competitor.id, competitor.name]),
    );
    const summaries = (changes ?? []).slice(0, 8).map((change) => {
      const page = pageById.get(change.monitored_page_id);
      const competitorName = page ? competitorById.get(page.competitor_id) : null;

      return competitorName
        ? `${competitorName}: ${change.diff_summary}`
        : change.diff_summary;
    });
    const result = await sendWeeklyDigestEmail({
      to: user.email,
      dashboardUrl: `${appUrl}/dashboard`,
      changeCount: changes?.length ?? 0,
      summaries,
    });

    if (result.sent) {
      sent += 1;
      await recordUsageEvent({
        supabase,
        userId: user.id,
        eventType: "weekly_digest",
        quantity: 1,
        estimatedCostEur: estimateScanCostEur(0),
        metadata: {
          changes: changes?.length ?? 0,
        },
      });
    } else if (result.skipped) {
      skipped += 1;
    } else {
      failures.push(result.error);
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    failures: failures.slice(0, 10),
  });
}

export async function POST(request: Request) {
  return runWeeklyDigest(request);
}

export async function GET(request: Request) {
  return runWeeklyDigest(request);
}
