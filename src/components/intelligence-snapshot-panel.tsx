import { formatDateTime } from "@/lib/format";
import type {
  IntelligenceDisplayView,
  IntelligenceFactView,
  IntelligenceSectionView,
} from "@/lib/intelligence/display";

type IntelligenceSnapshotPanelProps = {
  display: IntelligenceDisplayView;
  compact?: boolean;
};

const statusLabels: Record<IntelligenceSectionView["status"], string> = {
  found: "Found",
  unclear: "Unclear",
  unavailable: "Unavailable",
};

function statusClassName(status: IntelligenceSectionView["status"]) {
  switch (status) {
    case "found":
      return "bg-moss/10 text-moss";
    case "unclear":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-ink/5 text-ink/55";
  }
}

function sourceLabel(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname}${path}`.slice(0, 54);
  } catch {
    return url.slice(0, 54);
  }
}

function SourceEvidence({
  fact,
  showEvidence,
}: {
  fact?: IntelligenceFactView;
  showEvidence?: boolean;
}) {
  if (!fact) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1 text-xs leading-5 text-ink/55">
      <a
        href={fact.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-moss transition hover:text-moss/80"
      >
        Source: {sourceLabel(fact.sourceUrl)}
      </a>
      {showEvidence ? (
        <p className="text-ink/50">Evidence: {fact.evidenceText}</p>
      ) : null}
    </div>
  );
}

function IntelligenceSection({
  title,
  section,
  showEvidence,
}: {
  title: string;
  section: IntelligenceSectionView;
  showEvidence?: boolean;
}) {
  return (
    <div className="border-t border-ink/10 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClassName(
            section.status,
          )}`}
        >
          {statusLabels[section.status]}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-ink/70">{section.text}</p>
      <SourceEvidence fact={section.fact} showEvidence={showEvidence} />
    </div>
  );
}

function FeatureList({
  display,
  showEvidence,
}: {
  display: IntelligenceDisplayView;
  showEvidence?: boolean;
}) {
  return (
    <div className="border-t border-ink/10 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">Features</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            display.features.status === "found"
              ? "bg-moss/10 text-moss"
              : "bg-ink/5 text-ink/55"
          }`}
        >
          {display.features.status === "found" ? "Found" : "Unavailable"}
        </span>
      </div>
      {display.features.status === "found" ? (
        <ul className="mt-2 space-y-3">
          {display.features.facts.slice(0, showEvidence ? 10 : 3).map((fact) => (
            <li key={`${fact.sourceUrl}:${fact.value}`}>
              <p className="text-sm leading-6 text-ink/70">{fact.value}</p>
              <SourceEvidence fact={fact} showEvidence={showEvidence} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm leading-6 text-ink/70">
          {display.features.text}
        </p>
      )}
    </div>
  );
}

export function IntelligenceSnapshotPanel({
  display,
  compact = false,
}: IntelligenceSnapshotPanelProps) {
  const sections = compact
    ? [
        ["Pricing", display.pricing] as const,
        ["Positioning", display.positioning] as const,
        ["Changelog", display.changelog] as const,
      ]
    : [
        ["Pricing", display.pricing] as const,
        ["Positioning", display.positioning] as const,
        ["Primary CTA", display.cta] as const,
        ["Changelog", display.changelog] as const,
      ];

  return (
    <div className={compact ? "mt-4 border-t border-ink/10 pt-4" : ""}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">
          Baseline created
        </span>
        <span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">
          Snapshot ready
        </span>
        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/60">
          {display.pagesAnalyzed} pages analyzed
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-ink/70">
        {display.overview.text}
      </p>

      <p className="mt-2 text-xs leading-5 text-ink/45">
        Snapshot {formatDateTime(display.createdAt)} -{" "}
        {display.source === "openai" ? "AI summary" : "deterministic summary"} -{" "}
        {display.overallConfidence} confidence
      </p>

      <div
        className={
          compact
            ? "mt-4 grid gap-4 md:grid-cols-2"
            : "mt-5 grid gap-5 md:grid-cols-2"
        }
      >
        {sections.map(([title, section]) => (
          <IntelligenceSection
            key={title}
            title={title}
            section={section}
            showEvidence={!compact}
          />
        ))}
        <FeatureList display={display} showEvidence={!compact} />
      </div>

      {!compact && display.warnings.length ? (
        <div className="mt-5 border-t border-ink/10 pt-4">
          <h3 className="text-sm font-semibold text-ink">Warnings</h3>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-ink/60">
            {display.warnings.slice(0, 8).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
