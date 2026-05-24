import type { Database } from "@/lib/database.types";

export type PlanName = "free" | "pro" | "business";

export type UserPlanView = {
  name: PlanName;
  label: string;
  competitorLimit: number;
  scanIntervalHours: number;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
};

type UserRow = Database["public"]["Tables"]["users"]["Row"];

const planDefaults: Record<
  PlanName,
  Pick<UserPlanView, "competitorLimit" | "scanIntervalHours" | "label">
> = {
  free: {
    label: "Free",
    competitorLimit: 3,
    scanIntervalHours: 168,
  },
  pro: {
    label: "Pro",
    competitorLimit: 20,
    scanIntervalHours: 12,
  },
  business: {
    label: "Business",
    competitorLimit: 999,
    scanIntervalHours: 6,
  },
};

export function planViewFromUser(profile: Pick<
  UserRow,
  | "plan"
  | "competitor_limit"
  | "scan_interval_hours"
  | "subscription_status"
  | "current_period_end"
> | null): UserPlanView {
  const name =
    profile?.plan === "business"
      ? "business"
      : profile?.plan === "pro"
        ? "pro"
        : "free";
  const defaults = planDefaults[name];

  return {
    name,
    label: defaults.label,
    competitorLimit: profile?.competitor_limit ?? defaults.competitorLimit,
    scanIntervalHours:
      profile?.scan_interval_hours ?? defaults.scanIntervalHours,
    subscriptionStatus: profile?.subscription_status ?? "inactive",
    currentPeriodEnd: profile?.current_period_end ?? null,
  };
}

export function isAtCompetitorLimit({
  competitorCount,
  plan,
}: {
  competitorCount: number;
  plan: UserPlanView;
}) {
  return competitorCount >= plan.competitorLimit;
}
