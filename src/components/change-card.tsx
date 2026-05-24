import type { Json, PageType } from "@/lib/database.types";
import { formatDateTime, formatPageType, severityClassName } from "@/lib/format";

type ChangeCardProps = {
  id: string;
  summary: string;
  severity: "low" | "medium" | "high";
  changeType: string | null;
  oldValue?: Json | null;
  newValue?: Json | null;
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

type ChangeDetail = {
  category?: string;
  change_type?: string;
  summary?: string;
  old_value?: unknown;
  new_value?: unknown;
  why_it_matters?: string;
  confidence_score?: number;
  evidence?: EvidenceItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toEvidenceItem(value: unknown): EvidenceItem | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    source_url: typeof value.source_url === "string" ? value.source_url : undefined,
    evidence_text:
      typeof value.evidence_text === "string" ? value.evidence_text : undefined,
  };
}

function toChangeDetail(value: unknown): ChangeDetail | null {
  if (!isRecord(value)) {
    return null;
  }

  const evidence = Array.isArray(value.evidence)
    ? value.evidence
        .map(toEvidenceItem)
        .filter((item): item is EvidenceItem => Boolean(item))
    : undefined;

  return {
    category: typeof value.category === "string" ? value.category : undefined,
    change_type:
      typeof value.change_type === "string" ? value.change_type : undefined,
    summary: typeof value.summary === "string" ? value.summary : undefined,
    old_value: value.old_value,
    new_value: value.new_value,
    why_it_matters:
      typeof value.why_it_matters === "string" ? value.why_it_matters : undefined,
    confidence_score:
      typeof value.confidence_score === "number" ? value.confidence_score : undefined,
    evidence,
  };
}

function evidenceItems(value: Json): EvidenceItem[] {
  if (Array.isArray(value)) {
    return value
      .map(toEvidenceItem)
      .filter((item): item is EvidenceItem => Boolean(item));
  }

  if (isRecord(value)) {
    const primary = value.primary_evidence;

    return Array.isArray(primary)
      ? primary
          .map(toEvidenceItem)
          .filter((item): item is EvidenceItem => Boolean(item))
      : [];
  }

  return [];
}

function changeDetails(value: Json): ChangeDetail[] {
  if (!isRecord(value) || !Array.isArray(value.changes)) {
    return [];
  }

  return value.changes
    .map(toChangeDetail)
    .filter((item): item is ChangeDetail => Boolean(item));
}

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
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
  oldValue,
  newValue,
  evidenceJson,
  createdAt,
  pageType,
  pageUrl,
  competitorName,
  competitorHref,
}: ChangeCardProps) {
  const evidence = evidenceItems(evidenceJson);
  const details = changeDetails(evidenceJson);
  const sourceUrl = evidence[0]?.source_url || pageUrl;
  const displayOld = valueText(oldValue);
  const displayNew = valueText(newValue);
  const confidence =
    evidence.length >= 2
      ? "high confidence"
      : evidence.length
        ? "medium confidence"
        : "low confidence";

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
        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/60">
          {confidence}
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
      {displayOld || displayNew ? (
        <dl className="mt-3 grid gap-3 rounded-md bg-paper p-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/40">
              Old
            </dt>
            <dd className="mt-1 leading-6 text-ink/70">
              {displayOld ?? "Not previously detected"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/40">
              New
            </dt>
            <dd className="mt-1 leading-6 text-ink/80">
              {displayNew ?? "No longer detected"}
            </dd>
          </div>
        </dl>
      ) : null}
      <p className="mt-3 text-sm leading-6 text-ink/60">
        <span className="font-semibold text-ink">Why it matters:</span>{" "}
        {details[0]?.why_it_matters ?? whyFromSummary(summary)}
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
        {details.length > 1 ? (
          <details className="group">
            <summary className="cursor-pointer list-none text-ink/55 transition hover:text-ink">
              View grouped changes
            </summary>
            <ul className="mt-3 space-y-2 rounded-md bg-paper p-3 font-normal leading-5 text-ink/60">
              {details.slice(0, 6).map((item, index) => (
                <li key={`${item.change_type ?? "change"}:${index}`}>
                  <span className="font-semibold text-ink/70">
                    {item.category ?? "change"}:
                  </span>{" "}
                  {valueText(item.old_value) ?? "not detected"}{" "}
                  {"->"}{" "}
                  {valueText(item.new_value) ?? "not detected"}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </article>
  );
}
