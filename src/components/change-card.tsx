import type { Json, PageType } from "@/lib/database.types";
import { formatDateTime, formatPageType, severityClassName } from "@/lib/format";

type ChangeCardProps = {
  id: string;
  summary: string;
  severity: "low" | "medium" | "high";
  changeType: string | null;
  evidenceJson: Json;
  createdAt: string;
  pageType: PageType;
  pageUrl?: string;
  competitorName?: string;
  competitorHref?: string;
};

type EvidenceItem = {
  source_url?: string;
  evidence_text?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function evidenceItems(value: Json): EvidenceItem[] {
  return Array.isArray(value)
    ? value.filter((item): item is EvidenceItem => isRecord(item))
    : [];
}

function titleFromSummary(summary: string) {
  const firstSentence = summary.split(/(?<=[.!?])\s+/)[0] ?? summary;

  return firstSentence.length > 108
    ? `${firstSentence.slice(0, 105).trim()}...`
    : firstSentence;
}

function whyFromSummary(summary: string) {
  const sentences = summary.split(/(?<=[.!?])\s+/);

  return sentences[1] ?? "This may affect how prospects compare the competitor.";
}

function categoryLabel(changeType: string | null, pageType: PageType) {
  const value = changeType ?? pageType;

  if (/price|pricing|plan|free|contact_sales/i.test(value)) {
    return "pricing";
  }

  if (/cta|demo|trial|signup|sign_up/i.test(value)) {
    return "CTA";
  }

  if (/headline|position|customer|category|value_prop/i.test(value)) {
    return "positioning";
  }

  if (/feature/i.test(value)) {
    return "feature";
  }

  if (/changelog|release|update/i.test(value)) {
    return "changelog";
  }

  return formatPageType(pageType);
}

function sourceLabel(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;

    return `${parsed.hostname}${path}`.slice(0, 58);
  } catch {
    return url.slice(0, 58);
  }
}

export function ChangeCard({
  summary,
  severity,
  changeType,
  evidenceJson,
  createdAt,
  pageType,
  pageUrl,
  competitorName,
  competitorHref,
}: ChangeCardProps) {
  const evidence = evidenceItems(evidenceJson);
  const sourceUrl = evidence[0]?.source_url || pageUrl;

  return (
    <article className="rounded-md border border-ink/10 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/60">
          {categoryLabel(changeType, pageType)}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${severityClassName(
            severity,
          )}`}
        >
          {severity}
        </span>
        <span className="text-xs text-ink/45">
          {formatDateTime(createdAt)}
        </span>
      </div>

      {competitorName && competitorHref ? (
        <a
          href={competitorHref}
          className="mt-3 block text-sm font-semibold text-ink transition hover:text-moss"
        >
          {competitorName}
        </a>
      ) : null}

      <h3 className="mt-3 text-sm font-semibold leading-6 text-ink">
        {titleFromSummary(summary)}
      </h3>
      <p className="mt-1 text-sm leading-6 text-ink/60">
        {whyFromSummary(summary)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold">
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-moss transition hover:text-moss/80"
          >
            Source: {sourceLabel(sourceUrl)}
          </a>
        ) : null}
        {evidence.length ? (
          <details className="group">
            <summary className="cursor-pointer list-none text-ink/55 transition hover:text-ink">
              View evidence
            </summary>
            <ul className="mt-3 space-y-2 rounded-md bg-paper p-3 font-normal leading-5 text-ink/60">
              {evidence.slice(0, 4).map((item, index) => (
                <li key={`${item.source_url ?? "source"}:${index}`}>
                  {item.evidence_text ?? item.source_url}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </article>
  );
}
