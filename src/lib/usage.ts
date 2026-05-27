import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { isMasterAdminUser } from "@/lib/master-admin";
import { planViewFromUser, type UserPlanView } from "@/lib/plans";

type Supabase = SupabaseClient<Database>;

export type UsageEventType =
  | "competitor_initial_scan"
  | "first_competitor_added"
  | "first_scan_completed"
  | "first_product_added"
  | "manual_scan"
  | "scheduled_scan"
  | "manual_analysis"
  | "product_scan"
  | "browser_render"
  | "weekly_digest"
  | "demo_example_refresh"
  | "master_admin_action"
  | "recommendation_viewed"
  | "ai_summary"
  | "recommendations_generated"
  | "recommendation_feedback";

type UsageDecision = {
  allowed: boolean;
  reason?: string;
};

function readNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readNumberEnvAny(names: string[], fallback: number) {
  for (const name of names) {
    const value = Number(process.env[name]);

    if (Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return fallback;
}

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  return value === "true" || value === "1";
}

export function getUsageConfig() {
  return {
    monthlyCostBudgetEur: readNumberEnv("MONTHLY_COST_BUDGET_EUR", 20),
    aiMonthlyTokenLimit: readNumberEnv("AI_MONTHLY_TOKEN_LIMIT", 400_000),
    maxScansPerDayGlobal: readNumberEnv("MAX_SCANS_PER_DAY_GLOBAL", 80),
    maxScansPerUserPerDayFree: readNumberEnv(
      "MAX_SCANS_PER_USER_PER_DAY_FREE",
      1,
    ),
    maxScansPerUserPerDayPro: readNumberEnv(
      "MAX_SCANS_PER_USER_PER_DAY_PRO",
      5,
    ),
    maxScansPerUserPerDayBusiness: readNumberEnv(
      "MAX_SCANS_PER_USER_PER_DAY_BUSINESS",
      25,
    ),
    maxAiCallsPerDayGlobal: readNumberEnvAny(
      ["MAX_AI_CALLS_GLOBAL_PER_DAY", "MAX_AI_CALLS_PER_DAY_GLOBAL"],
      50,
    ),
    maxAiCallsPerUserPerDay: readNumberEnv("MAX_AI_CALLS_PER_USER_PER_DAY", 2),
    maxPagesPerScan: readNumberEnv("MAX_PAGES_PER_SCAN", 15),
    freeEnableAi: readBooleanEnv("FREE_ENABLE_AI", false),
    freeEnableBrowser: readBooleanEnv("FREE_ENABLE_BROWSER", false),
    freeCacheTtlDays: readNumberEnv("FREE_CACHE_TTL_DAYS", 7),
    freeMaxPages: readNumberEnv("FREE_MAX_PAGES", 2),
    freeMaxRuntimeMs: readNumberEnv("FREE_MAX_RUNTIME_MS", 5000),
    freeMaxRefreshPerDay: readNumberEnv("FREE_MAX_REFRESH_PER_DAY", 1),
    seedScanEnabled: readBooleanEnv("SEED_SCAN_ENABLED", false),
    seedEnableAi: readBooleanEnv("SEED_ENABLE_AI", false),
    seedEnableBrowser: readBooleanEnv("SEED_ENABLE_BROWSER", false),
    seedMaxUrlsPerRun: readNumberEnv("SEED_MAX_URLS_PER_RUN", 50),
    maxBrowserRenderPerUserPerDay: readNumberEnv(
      "MAX_BROWSER_RENDER_PER_USER_PER_DAY",
      3,
    ),
    maxBrowserRenderPerBusinessPerDay: readNumberEnv(
      "MAX_BROWSER_RENDER_PER_BUSINESS_PER_DAY",
      12,
    ),
    maxBrowserRenderGlobalPerDay: readNumberEnv(
      "MAX_BROWSER_RENDER_GLOBAL_PER_DAY",
      20,
    ),
    aiEstimatedEurPer1kTokens: readNumberEnv(
      "AI_ESTIMATED_EUR_PER_1K_TOKENS",
      0.0002,
    ),
  };
}

export const USAGE_DEFERRED_MESSAGE =
  "Analysis deferred due to usage limits. It will retry later.";

function sinceHours(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function monthStartIso() {
  const now = new Date();

  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

async function countEvents({
  supabase,
  userId,
  eventType,
  since,
}: {
  supabase: Supabase;
  userId?: string;
  eventType?: UsageEventType;
  since: string;
}) {
  let query = supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function sumMonthlyCost(supabase: Supabase) {
  const { data, error } = await supabase
    .from("usage_events")
    .select("estimated_cost_eur")
    .gte("created_at", monthStartIso());

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce(
    (sum, row) => sum + Number(row.estimated_cost_eur ?? 0),
    0,
  );
}

async function sumMonthlyAiTokens(supabase: Supabase) {
  const { data, error } = await supabase
    .from("usage_events")
    .select("quantity")
    .eq("event_type", "ai_summary")
    .gte("created_at", monthStartIso());

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, row) => sum + (row.quantity ?? 0), 0);
}

export async function getPlanForUser(
  supabase: Supabase,
  userId: string,
): Promise<UserPlanView> {
  const { data: profile, error } = await supabase
    .from("users")
    .select(
      "plan, competitor_limit, scan_interval_hours, subscription_status, current_period_end",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return planViewFromUser(profile);
}

export function estimateScanCostEur(pageCount: number) {
  return Number((Math.max(0, pageCount) * 0.0005).toFixed(6));
}

export function estimateAiCostEur(tokenCount: number) {
  const config = getUsageConfig();

  return Number(
    ((Math.max(0, tokenCount) / 1000) * config.aiEstimatedEurPer1kTokens).toFixed(
      6,
    ),
  );
}

export async function recordUsageEvent({
  supabase,
  userId,
  eventType,
  quantity = 1,
  estimatedCostEur = 0,
  metadata = {},
}: {
  supabase: Supabase;
  userId: string;
  eventType: UsageEventType;
  quantity?: number;
  estimatedCostEur?: number;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("usage_events").insert({
    user_id: userId,
    event_type: eventType,
    quantity,
    estimated_cost_eur: estimatedCostEur,
    metadata_json: toJson(metadata),
  });

  return error?.message ?? null;
}

async function masterAdminBypassDecision({
  supabase,
  userId,
  action,
}: {
  supabase: Supabase;
  userId: string;
  action: string;
}) {
  if (!(await isMasterAdminUser({ supabase, userId }))) {
    return false;
  }

  await recordUsageEvent({
    supabase,
    userId,
    eventType: "master_admin_action",
    metadata: { action },
  });

  return true;
}

async function budgetDecision(supabase: Supabase): Promise<UsageDecision> {
  const config = getUsageConfig();
  const monthlyCost = await sumMonthlyCost(supabase);

  if (monthlyCost >= config.monthlyCostBudgetEur) {
    return {
      allowed: false,
      reason: USAGE_DEFERRED_MESSAGE,
    };
  }

  return { allowed: true };
}

export async function canRunManualScan({
  supabase,
  userId,
}: {
  supabase: Supabase;
  userId: string;
}): Promise<UsageDecision> {
  if (
    await masterAdminBypassDecision({
      supabase,
      userId,
      action: "manual_scan_limit_bypass",
    })
  ) {
    return { allowed: true };
  }

  const [budget, plan, globalScans, userScans] = await Promise.all([
    budgetDecision(supabase),
    getPlanForUser(supabase, userId),
    countEvents({
      supabase,
      eventType: "manual_scan",
      since: sinceHours(24),
    }),
    countEvents({
      supabase,
      userId,
      eventType: "manual_scan",
      since: sinceHours(24),
    }),
  ]);
  const config = getUsageConfig();
  const userLimit =
    plan.name === "business"
      ? config.maxScansPerUserPerDayBusiness
      : plan.name === "pro"
        ? config.maxScansPerUserPerDayPro
        : config.maxScansPerUserPerDayFree;

  if (!budget.allowed) {
    return budget;
  }

  if (globalScans >= config.maxScansPerDayGlobal) {
    return {
      allowed: false,
      reason: USAGE_DEFERRED_MESSAGE,
    };
  }

  if (userScans >= userLimit) {
    return {
      allowed: false,
      reason: `${plan.label} plan manual scan limit reached: ${userLimit} per 24 hours.`,
    };
  }

  return { allowed: true };
}

export async function canRunScheduledScan({
  supabase,
  userId,
}: {
  supabase: Supabase;
  userId: string;
}): Promise<UsageDecision> {
  if (
    await masterAdminBypassDecision({
      supabase,
      userId,
      action: "scheduled_scan_limit_bypass",
    })
  ) {
    return { allowed: true };
  }

  const [budget, plan, globalScans, userScans] = await Promise.all([
    budgetDecision(supabase),
    getPlanForUser(supabase, userId),
    countEvents({
      supabase,
      eventType: "scheduled_scan",
      since: sinceHours(24),
    }),
    countEvents({
      supabase,
      userId,
      eventType: "scheduled_scan",
      since: sinceHours(24),
    }),
  ]);
  const config = getUsageConfig();
  const userLimit =
    plan.name === "business"
      ? config.maxScansPerUserPerDayBusiness
      : plan.name === "pro"
        ? config.maxScansPerUserPerDayPro
        : config.maxScansPerUserPerDayFree;

  if (!budget.allowed) {
    return budget;
  }

  if (globalScans >= config.maxScansPerDayGlobal) {
    return {
      allowed: false,
      reason: USAGE_DEFERRED_MESSAGE,
    };
  }

  if (userScans >= userLimit) {
    return {
      allowed: false,
      reason: `${plan.label} plan scheduled scan limit reached: ${userLimit} per 24 hours.`,
    };
  }

  return { allowed: true };
}

export async function canRunManualAnalysis({
  supabase,
  userId,
}: {
  supabase: Supabase;
  userId: string;
}): Promise<UsageDecision> {
  if (
    await masterAdminBypassDecision({
      supabase,
      userId,
      action: "manual_analysis_limit_bypass",
    })
  ) {
    return { allowed: true };
  }

  const plan = await getPlanForUser(supabase, userId);
  const config = getUsageConfig();
  const userLimit =
    plan.name === "business"
      ? config.maxScansPerUserPerDayBusiness
      : plan.name === "pro"
        ? config.maxScansPerUserPerDayPro
        : config.maxScansPerUserPerDayFree;
  const userRuns = await countEvents({
    supabase,
    userId,
    eventType: "manual_analysis",
    since: sinceHours(24),
  });

  if (userRuns >= userLimit) {
    return {
      allowed: false,
      reason: `${plan.label} plan re-analysis limit reached: ${userLimit} per 24 hours.`,
    };
  }

  return budgetDecision(supabase);
}

export async function canRunProductScan({
  supabase,
  userId,
}: {
  supabase: Supabase;
  userId: string;
}): Promise<UsageDecision> {
  if (
    await masterAdminBypassDecision({
      supabase,
      userId,
      action: "product_scan_limit_bypass",
    })
  ) {
    return { allowed: true };
  }

  const plan = await getPlanForUser(supabase, userId);
  const config = getUsageConfig();
  const userLimit =
    plan.name === "business"
      ? config.maxScansPerUserPerDayBusiness
      : plan.name === "pro"
        ? config.maxScansPerUserPerDayPro
        : config.maxScansPerUserPerDayFree;
  const userRuns = await countEvents({
    supabase,
    userId,
    eventType: "product_scan",
    since: sinceHours(24),
  });

  if (userRuns >= userLimit) {
    return {
      allowed: false,
      reason: `${plan.label} plan product analysis limit reached: ${userLimit} per 24 hours.`,
    };
  }

  return budgetDecision(supabase);
}

export async function canRunAiSummary({
  supabase,
  userId,
  estimatedTokens,
}: {
  supabase: Supabase;
  userId?: string;
  estimatedTokens: number;
}): Promise<UsageDecision> {
  const config = getUsageConfig();

  if (
    userId &&
    (await masterAdminBypassDecision({
      supabase,
      userId,
      action: "ai_limit_bypass",
    }))
  ) {
    return { allowed: true };
  }

  if (userId) {
    const plan = await getPlanForUser(supabase, userId);

    if (plan.name === "free" && !config.freeEnableAi) {
      return {
        allowed: false,
        reason: "AI summary skipped for the Free plan cost guard.",
      };
    }
  }

  const [budget, globalAiCalls, userAiCalls, monthlyTokens] = await Promise.all([
    budgetDecision(supabase),
    countEvents({
      supabase,
      eventType: "ai_summary",
      since: sinceHours(24),
    }),
    userId
      ? countEvents({
          supabase,
          userId,
          eventType: "ai_summary",
          since: sinceHours(24),
        })
      : Promise.resolve(0),
    sumMonthlyAiTokens(supabase),
  ]);

  if (!budget.allowed) {
    return budget;
  }

  if (globalAiCalls >= config.maxAiCallsPerDayGlobal) {
    return {
      allowed: false,
      reason: "AI summary skipped because the global daily AI limit was reached.",
    };
  }

  if (userId && userAiCalls >= config.maxAiCallsPerUserPerDay) {
    return {
      allowed: false,
      reason: "AI summary skipped because the daily user AI limit was reached.",
    };
  }

  if (monthlyTokens + estimatedTokens > config.aiMonthlyTokenLimit) {
    return {
      allowed: false,
      reason: "AI summary skipped because the monthly AI token limit was reached.",
    };
  }

  return { allowed: true };
}

export async function canRunBrowserRender({
  supabase,
  userId,
}: {
  supabase: Supabase;
  userId: string;
}): Promise<UsageDecision> {
  if (
    await masterAdminBypassDecision({
      supabase,
      userId,
      action: "browser_render_limit_bypass",
    })
  ) {
    return { allowed: true };
  }

  const config = getUsageConfig();
  const plan = await getPlanForUser(supabase, userId);

  if (plan.name !== "pro" && plan.name !== "business") {
    return {
      allowed: false,
      reason: "Browser rendering is reserved for Pro and Business usage limits.",
    };
  }

  const [budget, globalRenders, userRenders] = await Promise.all([
    budgetDecision(supabase),
    countEvents({
      supabase,
      eventType: "browser_render",
      since: sinceHours(24),
    }),
    countEvents({
      supabase,
      userId,
      eventType: "browser_render",
      since: sinceHours(24),
    }),
  ]);

  if (!budget.allowed) {
    return budget;
  }

  if (globalRenders >= config.maxBrowserRenderGlobalPerDay) {
    return {
      allowed: false,
      reason: USAGE_DEFERRED_MESSAGE,
    };
  }

  const renderLimit = plan.name === "business"
    ? config.maxBrowserRenderPerBusinessPerDay
    : config.maxBrowserRenderPerUserPerDay;

  if (userRenders >= renderLimit) {
    return {
      allowed: false,
      reason: USAGE_DEFERRED_MESSAGE,
    };
  }

  return { allowed: true };
}
