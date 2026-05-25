import type { Json, ProductRecommendation } from "@/lib/database.types";
import { saveRecommendationFeedbackAction } from "@/app/dashboard/your-product/actions";

type ProductRecommendationsPanelProps = {
  recommendations: ProductRecommendation[];
  competitorCount: number;
};

type EvidenceItem = {
  type?: string;
  competitor_name?: string;
  value?: string;
  source_url?: string;
  evidence_text?: string;
};

type RecommendationTrust = {
  priority_score?: number;
  visibility?: string;
  recommendation_value_score?: number;
  recommendation_value_tier?: string;
  basis?: string;
  consensus?: {
    supporting_competitors?: number;
    required_competitors?: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function evidenceList(value: unknown): EvidenceItem[] {
  return Array.isArray(value)
    ? value.filter((item): item is EvidenceItem => isRecord(item))
    : [];
}

function parseEvidence(value: Json) {
  const evidence = isRecord(value) ? value : {};
  const trust = isRecord(evidence.trust)
    ? (evidence.trust as RecommendationTrust)
    : null;

  return {
    userEvidence: evidenceList(evidence.user_evidence),
    competitorEvidence: evidenceList(evidence.competitor_evidence),
    interpretation:
      typeof evidence.interpretation === "string"
        ? evidence.interpretation
        : null,
    trust,
  };
}

function sourceLabel(url?: string) {
  if (!url) {
    return "Source";
  }

  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;

    return `${parsed.hostname}${path}`.slice(0, 58);
  } catch {
    return url.slice(0, 58);
  }
}

function EvidenceList({
  title,
  items,
}: {
  title: string;
  items: EvidenceItem[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">
        {title}
      </h4>
      <ul className="mt-2 space-y-2">
        {items.slice(0, 4).map((item, index) => (
          <li
            key={`${item.source_url ?? title}:${item.value ?? index}`}
            className="rounded-md bg-paper p-3 text-xs leading-5 text-ink/60"
          >
            <p className="font-semibold text-ink/70">
              {item.competitor_name ? `${item.competitor_name}: ` : ""}
              {item.value}
            </p>
            {item.evidence_text ? <p>{item.evidence_text}</p> : null}
            {item.source_url ? (
              <a
                href={item.source_url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-moss transition hover:text-moss/80"
              >
                Source: {sourceLabel(item.source_url)}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeedbackForm({ recommendationId }: { recommendationId: string }) {
  const options = [
    ["useful", "Useful"],
    ["not_useful", "Not useful"],
    ["already_knew", "Already knew this"],
    ["implemented", "Implemented"],
    ["resolved", "Mark as resolved"],
  ] as const;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {options.map(([value, label]) => (
        <form key={value} action={saveRecommendationFeedbackAction}>
          <input
            type="hidden"
            name="recommendationId"
            value={recommendationId}
          />
          <input type="hidden" name="feedback" value={value} />
          <button
            type="submit"
            className="rounded-md border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink/60 transition hover:border-moss/30 hover:text-moss"
          >
            {label}
          </button>
        </form>
      ))}
    </div>
  );
}

export function ProductRecommendationsPanel({
  recommendations,
  competitorCount,
}: ProductRecommendationsPanelProps) {
  if (!recommendations.length) {
    const reason = competitorCount
      ? "Current evidence is either too weak, too generic, or unchanged to justify a high-confidence next action."
      : "Add your product baseline or track competitors to create enough verified evidence.";

    return (
      <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <h2 className="text-xl font-semibold text-ink">Recommendations</h2>
        <p className="mt-3 rounded-md bg-paper p-4 text-sm leading-6 text-ink/65">
          No strong recommendation yet. {reason}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-semibold text-ink">Recommendations</h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            Only recommendations with user evidence, competitor evidence, and a
            business interpretation are shown.
          </p>
        </div>
        <span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">
          {recommendations.length} strong
        </span>
      </div>

      <div className="mt-6 space-y-5">
        {recommendations.map((recommendation) => {
          const evidence = parseEvidence(recommendation.evidence_json);

          return (
            <article
              key={recommendation.id}
              className="rounded-lg border border-ink/10 p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-moss/10 px-2.5 py-1 text-[11px] font-semibold text-moss">
                  {recommendation.confidence_label.replace("_", " ")}
                </span>
                <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink/55">
                  {recommendation.confidence}/100 confidence
                </span>
                <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink/55">
                  {recommendation.actionability} actionability
                </span>
                {evidence.trust?.basis ? (
                  <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink/55">
                    {evidence.trust.basis.replace("_", " ")}
                  </span>
                ) : null}
                {typeof evidence.trust?.priority_score === "number" ? (
                  <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink/55">
                    {evidence.trust.priority_score}/100 priority
                  </span>
                ) : null}
                {typeof evidence.trust?.recommendation_value_score === "number" ? (
                  <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink/55">
                    {evidence.trust.recommendation_value_score}/70 usefulness
                  </span>
                ) : null}
                {evidence.trust?.consensus?.supporting_competitors &&
                evidence.trust.consensus.required_competitors ? (
                  <span className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink/55">
                    {evidence.trust.consensus.supporting_competitors}/
                    {evidence.trust.consensus.required_competitors} consensus
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-ink">
                {recommendation.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink/70">
                <span className="font-semibold text-ink">Suggested action:</span>{" "}
                {recommendation.explanation}
              </p>
              <p className="mt-3 text-sm leading-6 text-ink/65">
                <span className="font-semibold text-ink">Why this matters:</span>{" "}
                {recommendation.why_this_matters}
              </p>
              <details className="mt-4 rounded-md bg-paper p-3">
                <summary className="cursor-pointer list-none text-xs font-semibold text-ink/60 transition hover:text-ink">
                  Expand for evidence (
                  {evidence.userEvidence.length +
                    evidence.competitorEvidence.length}
                  )
                </summary>
                {evidence.interpretation ? (
                  <p className="mt-3 text-xs leading-5 text-ink/60">
                    {evidence.interpretation}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <EvidenceList
                    title="Your product evidence"
                    items={evidence.userEvidence}
                  />
                  <EvidenceList
                    title="Competitor evidence"
                    items={evidence.competitorEvidence}
                  />
                </div>
              </details>
              <FeedbackForm recommendationId={recommendation.id} />
            </article>
          );
        })}
      </div>
    </div>
  );
}
