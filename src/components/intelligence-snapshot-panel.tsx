import { formatDateTime } from "@/lib/format";
import type {
  IntelligenceDisplayView,
  IntelligenceFactView,
  IntelligenceSectionView,
  PricingExperienceState,
  PricingOptionView,
} from "@/lib/intelligence/display";
import type { ScanQualitySummary } from "@/lib/scan-quality";

type IntelligenceSnapshotPanelProps = {
  display: IntelligenceDisplayView;
  compact?: boolean;
};

const statusLabels: Record<IntelligenceSectionView["status"], string> = {
  found: "Found",
  unclear: "Unclear",
  unavailable: "Unavailable",
};

const pricingStateLabels: Record<PricingExperienceState, string> = {
  public_pricing: "Public pricing",
  contact_sales: "Contact sales",
  pricing_unclear: "Pricing unclear",
  pricing_scanning: "Pricing scanning",
  no_public_pricing: "No public pricing",
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

function pricingStateClassName(state: PricingExperienceState) {
  switch (state) {
    case "public_pricing":
      return "bg-moss/10 text-moss";
    case "contact_sales":
    case "pricing_unclear":
    case "pricing_scanning":
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

function PricingOption({
  option,
  showEvidence,
}: {
  option: PricingOptionView;
  showEvidence?: boolean;
}) {
  return (
    <li className="rounded-md bg-paper px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-ink/75">{option.label}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pricingStateClassName(
            option.state,
          )}`}
        >
          {pricingStateLabels[option.state]}
        </span>
      </div>
      <p className="mt-1 text-sm leading-6 text-ink/70">{option.text}</p>
      <SourceEvidence fact={option.fact} showEvidence={showEvidence} />
    </li>
  );
}

function PricingExperienceSection({
  display,
  showEvidence,
}: {
  display: IntelligenceDisplayView;
  showEvidence?: boolean;
}) {
  return (
    <div className="border-t border-ink/10 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">Pricing</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pricingStateClassName(
            display.pricingState,
          )}`}
        >
          {pricingStateLabels[display.pricingState]}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-ink/70">
        {display.pricing.text}
      </p>
      <ul className="mt-3 space-y-2">
        {display.pricingOptions.map((option) => (
          <PricingOption
            key={`${option.label}:${option.text}:${option.fact?.sourceUrl ?? ""}`}
            option={option}
            showEvidence={showEvidence}
          />
        ))}
      </ul>
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

function BusinessProfileOverview({ display }: { display: IntelligenceDisplayView }) {
  const profile = display.businessProfile;

  if (!profile) {
    return (
      <p className="mt-3 text-sm leading-6 text-ink/70">
        {display.overview.text}
      </p>
    );
  }

  const missingSignals = [
    display.pricing.status === "unavailable" ? "pricing" : null,
    display.positioning.status !== "found" ? "positioning" : null,
    display.cta.status !== "found" ? "CTA" : null,
    display.features.status !== "found" ? "features" : null,
    display.changelog.status !== "found" ? "changelog" : null,
  ].filter(Boolean);
  const rows = [
    [
      "Purpose",
      profile.product_summary.value_props[0] ??
        profile.product_summary.use_cases[0] ??
        "Positioning unclear from public page content.",
    ],
    [
      "Positioning",
      [
        profile.product_summary.category,
        profile.product_summary.target_customers.slice(0, 2).join(", "),
      ]
        .filter(Boolean)
        .join(" for ") || "Positioning unclear from public page content.",
    ],
    ["CTA", profile.conversion.primary_cta ?? "No clear CTA detected."],
    [
      "Pricing state",
      pricingStateLabels[display.pricingState],
    ],
    [
      "Confidence",
      `${display.overallConfidence} confidence${
        display.scanQuality ? `, scan ${display.scanQuality.score}/100` : ""
      }`,
    ],
    [
      "Missing signals",
      missingSignals.length ? missingSignals.join(", ") : "Core signals found.",
    ],
  ];

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md bg-paper p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/40">
            {label}
          </p>
          <p className="mt-1 text-sm leading-6 text-ink/70">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Watchlist({ display }: { display: IntelligenceDisplayView }) {
  const suggestions = display.businessProfile?.watchlist_suggestions ?? [];

  if (!suggestions.length) {
    return null;
  }

  return (
    <div className="mt-5 border-t border-ink/10 pt-4">
      <h3 className="text-sm font-semibold text-ink">Worth watching</h3>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-ink/60 md:grid-cols-2">
        {suggestions.slice(0, 4).map((suggestion) => (
          <li key={suggestion} className="rounded-md bg-paper px-3 py-2">
            {suggestion}
          </li>
        ))}
      </ul>
    </div>
  );
}

function qualityClassName(quality: ScanQualitySummary) {
  if (quality.label === "high") {
    return "bg-moss/10 text-moss";
  }

  if (quality.label === "medium") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-ink/5 text-ink/55";
}

function ScanQualityBadge({ quality }: { quality: ScanQualitySummary | null }) {
  if (!quality) {
    return null;
  }

  const label =
    quality.delivery_status === "useful"
      ? "Useful scan"
      : quality.delivery_status === "failed"
        ? "Failed scan"
        : quality.label === "medium"
          ? "Partial scan"
          : "Limited scan";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${qualityClassName(
        quality,
      )}`}
    >
      {label} {quality.score}/100
    </span>
  );
}

function ScanQualityDetails({
  quality,
  compact,
}: {
  quality: ScanQualitySummary | null;
  compact: boolean;
}) {
  if (!quality || compact || quality.label === "high") {
    return null;
  }

  const pendingStages = quality.progressive_stages.filter(
    (stage) => stage.status !== "ready",
  );

  return (
    <div className="mt-5 rounded-md bg-paper p-4 text-sm leading-6 text-ink/65">
      <p className="font-semibold text-ink">
        {quality.delivery_status === "useful"
          ? "Useful scan"
          : quality.delivery_status === "failed"
            ? "Scan failed"
            : "Limited scan"}
      </p>
      <p className="mt-1">{quality.confidence_impact}</p>
      {typeof quality.time_to_useful_insight_ms === "number" ? (
        <p className="mt-2">
          Useful insight after {quality.time_to_useful_insight_ms}ms. Full
          target: {quality.dashboard_complete_target_ms}ms.
        </p>
      ) : null}
      {quality.completed.length ? (
        <p className="mt-2">
          Completed: {quality.completed.slice(0, 5).join(", ")}.
        </p>
      ) : null}
      {quality.skipped.length ? (
        <p className="mt-1">Skipped: {quality.skipped.slice(0, 5).join(", ")}.</p>
      ) : null}
      {pendingStages.length ? (
        <p className="mt-1">
          Still scanning: {pendingStages.map((stage) => stage.message).join(" ")}
        </p>
      ) : null}
    </div>
  );
}

export function IntelligenceSnapshotPanel({
  display,
  compact = false,
}: IntelligenceSnapshotPanelProps) {
  const sections = compact
    ? [
        ["Positioning", display.positioning] as const,
        ["Changelog", display.changelog] as const,
      ]
    : [
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
        <ScanQualityBadge quality={display.scanQuality} />
      </div>

      <BusinessProfileOverview display={display} />

      <p className="mt-2 text-xs leading-5 text-ink/45">
        Snapshot {formatDateTime(display.createdAt)} -{" "}
        {display.source === "openai" ? "AI summary" : "deterministic summary"} -{" "}
        {display.overallConfidence} confidence
      </p>

      <ScanQualityDetails quality={display.scanQuality} compact={compact} />

      <div
        className={
          compact
            ? "mt-4 grid gap-4 md:grid-cols-2"
            : "mt-5 grid gap-5 md:grid-cols-2"
        }
      >
        <PricingExperienceSection display={display} showEvidence={!compact} />
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

      <Watchlist display={display} />

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
