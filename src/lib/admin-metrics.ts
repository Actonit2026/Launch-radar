import { getUsageConfig } from "@/lib/usage";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMasterAdminEmail } from "@/lib/master-admin";

function dayStartIso() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

function monthStartIso() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function countByType(
  events: Array<{
    event_type: string;
    quantity: number | null;
    estimated_cost_eur: number | null;
  }>,
  type: string,
) {
  return events
    .filter((event) => event.event_type === type)
    .reduce((sum, event) => sum + Number(event.quantity ?? 1), 0);
}

export function isAdminEmail(email?: string | null) {
  return isMasterAdminEmail(email);
}

export async function getAdminCostMetrics() {
  const supabase = getSupabaseAdminClient();
  const sinceDay = dayStartIso();
  const sinceMonth = monthStartIso();
  const [{ data: todayEvents, error: todayError }, { data: monthEvents, error: monthError }] =
    await Promise.all([
      supabase
        .from("usage_events")
        .select("user_id, event_type, quantity, estimated_cost_eur, created_at")
        .gte("created_at", sinceDay),
      supabase
        .from("usage_events")
        .select("user_id, event_type, quantity, estimated_cost_eur, created_at")
        .gte("created_at", sinceMonth),
    ]);

  if (todayError || monthError) {
    throw new Error(todayError?.message ?? monthError?.message ?? "Could not load metrics.");
  }

  const eventsToday = todayEvents ?? [];
  const eventsThisMonth = monthEvents ?? [];
  const topUsersByCost = Array.from(
    eventsThisMonth.reduce((map, event) => {
      const current = map.get(event.user_id) ?? 0;
      map.set(event.user_id, current + Number(event.estimated_cost_eur ?? 0));
      return map;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, cost]) => ({
      userId,
      cost: Number(cost.toFixed(4)),
    }));

  const estimatedMonthlyCost = eventsThisMonth.reduce(
    (sum, event) => sum + Number(event.estimated_cost_eur ?? 0),
    0,
  );
  const config = getUsageConfig();

  return {
    scansToday: countByType(eventsToday, "manual_scan") +
      countByType(eventsToday, "competitor_initial_scan") +
      countByType(eventsToday, "product_scan"),
    pagesFetchedToday: eventsToday
      .filter((event) =>
        ["manual_scan", "competitor_initial_scan", "manual_analysis", "product_scan"].includes(
          event.event_type,
        ),
      )
      .reduce((sum, event) => sum + Number(event.quantity ?? 0), 0),
    browserRendersToday: countByType(eventsToday, "browser_render"),
    aiCallsToday: countByType(eventsToday, "ai_summary"),
    weeklyDigestsToday: countByType(eventsToday, "weekly_digest"),
    estimatedMonthlyCost: Number(estimatedMonthlyCost.toFixed(4)),
    monthlyBudget: config.monthlyCostBudgetEur,
    costGuards: {
      freeAiEnabled: config.freeEnableAi,
      freeBrowserEnabled: config.freeEnableBrowser,
      freeMaxPages: config.freeMaxPages,
      freeMaxRuntimeMs: config.freeMaxRuntimeMs,
      freeMaxRefreshPerDay: config.freeMaxRefreshPerDay,
      seedScanEnabled: config.seedScanEnabled,
      seedMaxUrlsPerRun: config.seedMaxUrlsPerRun,
    },
    topUsersByCost,
  };
}
