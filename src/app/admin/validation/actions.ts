"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { refreshHomepageDemoExamples } from "@/lib/demo-examples";
import { isMasterAdminEmail } from "@/lib/master-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordUsageEvent } from "@/lib/usage";
import {
  getValidationRuns,
  runFollowUpValidationSuite,
  runScenarioValidation,
  runSingleUrlValidation,
  runValidationSuite,
  saveValidationRun,
  type ValidationSuiteReport,
} from "@/lib/validation/suite";

async function requireMasterAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isMasterAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  return user;
}

async function logAdminValidationAction({
  userId,
  action,
  report,
}: {
  userId: string;
  action: string;
  report: ValidationSuiteReport;
}) {
  await recordUsageEvent({
    supabase: getSupabaseAdminClient(),
    userId,
    eventType: "master_admin_action",
    quantity: report.cases.length,
    metadata: {
      action,
      pass_count: report.pass_count,
      fail_count: report.fail_count,
      ship_ready: report.ship_ready,
    },
  });
}

async function saveAndRefresh({
  userId,
  action,
  report,
}: {
  userId: string;
  action: string;
  report: ValidationSuiteReport;
}) {
  await saveValidationRun({ userId, report });
  await logAdminValidationAction({ userId, action, report });
  revalidatePath("/admin/validation");
}

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function runFullValidationSuiteAction() {
  const user = await requireMasterAdmin();
  const report = await runValidationSuite();

  await saveAndRefresh({
    userId: user.id,
    action: "run_full_validation_suite",
    report,
  });
}

export async function runFailedValidationCasesAction() {
  const user = await requireMasterAdmin();
  const [latest] = await getValidationRuns(1);
  const cases = recordFromUnknown(latest?.report_json)?.cases;
  const failedNames = Array.isArray(cases)
    ? cases.flatMap((item) => {
        const record = recordFromUnknown(item);

        if (!record || record.ship_ready_for_this_case !== false) {
          return [];
        }

        return typeof record.product_name === "string" && record.product_name
          ? [record.product_name]
          : [];
      })
    : [];
  const report = await runValidationSuite({
    names: failedNames.length ? failedNames : undefined,
  });

  await saveAndRefresh({
    userId: user.id,
    action: "rerun_failed_validation_cases",
    report,
  });
}

export async function runFollowUpValidationScanAction() {
  const user = await requireMasterAdmin();
  const [latest] = await getValidationRuns(1);
  const previousReport = recordFromUnknown(latest?.report_json)
    ? (latest?.report_json as unknown as ValidationSuiteReport)
    : null;
  const report = await runFollowUpValidationSuite(previousReport);

  await saveAndRefresh({
    userId: user.id,
    action: "run_follow_up_validation_scan",
    report,
  });
}

export async function runSingleUrlValidationAction(formData: FormData) {
  const user = await requireMasterAdmin();
  const url = String(formData.get("url") ?? "").trim();

  if (!url) {
    return;
  }

  const report = await runSingleUrlValidation(url);

  await saveAndRefresh({
    userId: user.id,
    action: "run_single_url_validation",
    report,
  });
}

export async function runScenarioValidationAction(formData: FormData) {
  const user = await requireMasterAdmin();
  const productUrl = String(formData.get("productUrl") ?? "").trim();
  const competitorA = String(formData.get("competitorA") ?? "").trim();
  const competitorB = String(formData.get("competitorB") ?? "").trim();

  if (!productUrl || !competitorA || !competitorB) {
    return;
  }

  const report = await runScenarioValidation({
    productUrl,
    competitorUrls: [competitorA, competitorB],
  });

  await saveAndRefresh({
    userId: user.id,
    action: "run_manual_scenario_validation",
    report,
  });
}

export async function refreshHomepageExamplesFromValidationAction() {
  const user = await requireMasterAdmin();
  const startedAt = new Date().toISOString();
  const result = await refreshHomepageDemoExamples();
  const completedAt = new Date().toISOString();
  const report: ValidationSuiteReport = {
    run_type: "homepage_examples",
    started_at: startedAt,
    completed_at: completedAt,
    ai_enabled: false,
    cases: result.examples.map((example) => ({
      product_name: example.name,
      url: example.site_url,
      analyzer_status: example.status === "success" ? "found" : "failed",
      pricing_status: example.pricing.includes("No public")
        ? "not_public"
        : "found",
      positioning_status: example.positioning ? "found" : "unclear",
      cta_status: example.cta === "No clear CTA" ? "unclear" : "found",
      feature_status: example.feature_signal ? "found" : "unclear",
      competitor_count: 0,
      recommendations_status: "Homepage example validation only",
      day_one_baseline_status:
        example.status === "success" ? "created" : "failed",
      baseline_timestamp: example.last_verified_at,
      baseline_hashes: null,
      facts_detected: 4,
      watchlist_suggestions: [],
      failures: [],
      warnings: [],
      ship_ready_for_this_case: example.status === "success",
    })),
    pass_count: result.saved,
    fail_count: result.failed,
    ship_ready: result.saved === 3,
  };

  await saveAndRefresh({
    userId: user.id,
    action: "refresh_homepage_examples_from_validation",
    report,
  });
  revalidatePath("/");
  revalidatePath("/admin/demo-examples");
}
