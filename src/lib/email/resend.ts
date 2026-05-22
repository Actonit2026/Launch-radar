import { Resend } from "resend";
import type { DetectedChange, PageType } from "@/lib/database.types";
import { formatDateTime, formatPageType } from "@/lib/format";

type ChangeAlertEmail = {
  to: string;
  competitorName: string;
  pageType: PageType;
  pageUrl: string;
  summary: string;
  severity: DetectedChange["severity"];
  createdAt: string;
};

type WeeklyDigestEmail = {
  to: string;
  dashboardUrl: string;
  changeCount: number;
  summaries: string[];
};

type EmailResult =
  | {
      sent: true;
      id: string | null;
      skipped?: never;
      error?: never;
    }
  | {
      sent: false;
      skipped: true;
      error?: never;
      id?: never;
    }
  | {
      sent: false;
      error: string;
      skipped?: never;
      id?: never;
    };

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "LaunchRadar <onboarding@resend.dev>";

  if (!apiKey) {
    return null;
  }

  return { apiKey, fromEmail };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderChangeAlertEmail(alert: ChangeAlertEmail) {
  const pageLabel = formatPageType(alert.pageType);
  const escapedSummary = escapeHtml(alert.summary);
  const escapedCompetitor = escapeHtml(alert.competitorName);
  const escapedPageUrl = escapeHtml(alert.pageUrl);
  const escapedSeverity = escapeHtml(alert.severity);

  return {
    subject: `[LaunchRadar] ${escapedCompetitor} changed ${pageLabel.toLowerCase()}`,
    text: [
      `${alert.competitorName} changed ${pageLabel.toLowerCase()}.`,
      "",
      alert.summary,
      "",
      `Severity: ${alert.severity}`,
      `Detected: ${formatDateTime(alert.createdAt)}`,
      `Page: ${alert.pageUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #17212b; line-height: 1.55;">
        <p style="margin: 0 0 12px; color: #286f5d; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;">LaunchRadar alert</p>
        <h1 style="margin: 0 0 16px; font-size: 24px; line-height: 1.2;">${escapedCompetitor} changed ${pageLabel.toLowerCase()}</h1>
        <p style="margin: 0 0 18px; font-size: 16px;">${escapedSummary}</p>
        <table style="border-collapse: collapse; margin: 0 0 20px; width: 100%; max-width: 520px;">
          <tr>
            <td style="border-top: 1px solid #e6e1d8; padding: 10px 0; color: #66717d;">Severity</td>
            <td style="border-top: 1px solid #e6e1d8; padding: 10px 0; font-weight: 700; text-transform: capitalize;">${escapedSeverity}</td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #e6e1d8; padding: 10px 0; color: #66717d;">Detected</td>
            <td style="border-top: 1px solid #e6e1d8; padding: 10px 0;">${formatDateTime(alert.createdAt)}</td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #e6e1d8; padding: 10px 0; color: #66717d;">Page</td>
            <td style="border-top: 1px solid #e6e1d8; padding: 10px 0;"><a href="${escapedPageUrl}" style="color: #286f5d;">${escapedPageUrl}</a></td>
          </tr>
        </table>
      </div>
    `,
  };
}

function renderWeeklyDigestEmail(digest: WeeklyDigestEmail) {
  const escapedDashboardUrl = escapeHtml(digest.dashboardUrl);
  const summaries = digest.summaries.length
    ? digest.summaries
    : ["No meaningful competitor changes detected this week."];
  const listItems = summaries
    .slice(0, 8)
    .map((summary) => `<li>${escapeHtml(summary)}</li>`)
    .join("");

  return {
    subject:
      digest.changeCount > 0
        ? `[LaunchRadar] ${digest.changeCount} meaningful changes this week`
        : "[LaunchRadar] No meaningful changes this week",
    text: [
      "LaunchRadar weekly digest",
      "",
      ...summaries.map((summary) => `- ${summary}`),
      "",
      `Open dashboard: ${digest.dashboardUrl}`,
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #17212b; line-height: 1.55;">
        <p style="margin: 0 0 12px; color: #286f5d; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;">LaunchRadar weekly digest</p>
        <h1 style="margin: 0 0 16px; font-size: 24px; line-height: 1.2;">${digest.changeCount > 0 ? "Meaningful competitor changes" : "No meaningful changes detected"}</h1>
        <ul style="margin: 0 0 20px; padding-left: 20px;">${listItems}</ul>
        <p><a href="${escapedDashboardUrl}" style="color: #286f5d; font-weight: 700;">Open dashboard</a></p>
      </div>
    `,
  };
}

export function isEmailConfigured() {
  return Boolean(getEmailConfig());
}

export async function sendChangeAlertEmail(
  alert: ChangeAlertEmail,
): Promise<EmailResult> {
  const config = getEmailConfig();

  if (!config) {
    return { sent: false, skipped: true };
  }

  const resend = new Resend(config.apiKey);
  const email = renderChangeAlertEmail(alert);
  const { data, error } = await resend.emails.send({
    from: config.fromEmail,
    to: [alert.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (error) {
    return { sent: false, error: error.message };
  }

  return { sent: true, id: data?.id ?? null };
}

export async function sendWeeklyDigestEmail(
  digest: WeeklyDigestEmail,
): Promise<EmailResult> {
  const config = getEmailConfig();

  if (!config) {
    return { sent: false, skipped: true };
  }

  const resend = new Resend(config.apiKey);
  const email = renderWeeklyDigestEmail(digest);
  const { data, error } = await resend.emails.send({
    from: config.fromEmail,
    to: [digest.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (error) {
    return { sent: false, error: error.message };
  }

  return { sent: true, id: data?.id ?? null };
}
