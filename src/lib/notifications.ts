import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  DetectedChange,
  MonitoredPage,
  PageType,
} from "@/lib/database.types";
import { sendChangeAlertEmail } from "@/lib/email/resend";

type Supabase = SupabaseClient<Database>;

type ChangeNotification = {
  recipientEmail: string;
  competitorName: string;
  pageType: PageType;
  pageUrl: string;
  change: Pick<
    DetectedChange,
    "id" | "diff_summary" | "severity" | "created_at"
  >;
};

type NotificationResult = {
  sent: boolean;
  skipped: boolean;
  error?: string;
  emailId?: string | null;
};

export function isSignificantChange(severity: DetectedChange["severity"]) {
  return severity === "medium" || severity === "high";
}

export async function sendChangeNotification({
  recipientEmail,
  competitorName,
  pageType,
  pageUrl,
  change,
}: ChangeNotification): Promise<NotificationResult> {
  if (!isSignificantChange(change.severity)) {
    return { sent: false, skipped: true };
  }

  const result = await sendChangeAlertEmail({
    to: recipientEmail,
    competitorName,
    pageType,
    pageUrl,
    summary: change.diff_summary,
    severity: change.severity,
    createdAt: change.created_at,
  });

  if (result.sent) {
    return { sent: true, skipped: false, emailId: result.id };
  }

  if (result.skipped) {
    return { sent: false, skipped: true };
  }

  return { sent: false, skipped: false, error: result.error };
}

export async function getNotificationRecipient(
  supabase: Supabase,
  userId: string,
) {
  const { data, error } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.email ?? null;
}

export async function sendDetectedChangeNotification({
  supabase,
  userId,
  changeId,
}: {
  supabase: Supabase;
  userId: string;
  changeId: string;
}) {
  const recipientEmail = await getNotificationRecipient(supabase, userId);

  if (!recipientEmail) {
    return {
      data: { sent: false, skipped: true, reason: "No recipient email." },
    };
  }

  const { data: change, error: changeError } = await supabase
    .from("detected_changes")
    .select("id, diff_summary, severity, created_at, monitored_page_id")
    .eq("id", changeId)
    .maybeSingle();

  if (changeError) {
    return { data: null, error: changeError.message };
  }

  if (!change) {
    return { data: null, error: "Detected change not found." };
  }

  const { data: page, error: pageError } = await supabase
    .from("monitored_pages")
    .select("*")
    .eq("id", change.monitored_page_id)
    .maybeSingle();

  if (pageError) {
    return { data: null, error: pageError.message };
  }

  if (!page) {
    return { data: null, error: "Monitored page not found." };
  }

  const { data: competitor, error: competitorError } = await supabase
    .from("competitors")
    .select("name")
    .eq("id", page.competitor_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (competitorError) {
    return { data: null, error: competitorError.message };
  }

  if (!competitor) {
    return { data: null, error: "Competitor not found." };
  }

  const result = await sendChangeNotification({
    recipientEmail,
    competitorName: competitor.name,
    pageType: page.page_type,
    pageUrl: page.url,
    change,
  });

  return { data: result };
}

export type ChangeNotificationContext = {
  recipientEmail: string | null;
  competitorById: Map<string, { name: string }>;
};

export function notificationForPage({
  context,
  monitoredPage,
  change,
}: {
  context: ChangeNotificationContext;
  monitoredPage: MonitoredPage;
  change: Pick<
    DetectedChange,
    "id" | "diff_summary" | "severity" | "created_at"
  >;
}) {
  const competitor = context.competitorById.get(monitoredPage.competitor_id);

  if (!context.recipientEmail || !competitor) {
    return null;
  }

  return {
    recipientEmail: context.recipientEmail,
    competitorName: competitor.name,
    pageType: monitoredPage.page_type,
    pageUrl: monitoredPage.url,
    change,
  };
}
