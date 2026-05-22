import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getDemoExamples } from "@/lib/demo-examples";
import { formatDateTime } from "@/lib/format";

export default async function Home() {
  const user = await getCurrentUser();
  const href = user ? "/dashboard" : "/signup";
  const demoCache = getDemoExamples();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-6xl flex-col gap-12 px-6 py-12">
      <section>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-coral">
          Competitor intelligence
        </p>
        <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.05] text-ink sm:text-6xl">
          Track meaningful competitor moves, not noisy website diffs.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
          LaunchRadar monitors competitor pricing, positioning, CTAs, features,
          and launches, then shows only evidence-backed changes that matter.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={href}
            className="inline-flex h-12 items-center justify-center rounded-md bg-moss px-6 text-sm font-semibold text-white transition hover:bg-moss/90"
          >
            Start tracking free
          </Link>
          <Link
            href={user ? "/dashboard/your-product" : "/pricing"}
            className="inline-flex h-12 items-center justify-center rounded-md border border-ink/15 bg-white px-6 text-sm font-semibold text-ink transition hover:border-ink/35"
          >
            {user ? "Compare your product" : "View pricing"}
          </Link>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-5">
        {[
          "Paste your product URL",
          "Add competitors",
          "Extract evidence-backed facts",
          "Monitor meaningful changes",
          "Recommend what to improve",
        ].map((step, index) => (
          <div key={step} className="rounded-lg border border-ink/10 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">
              {index + 1}
            </p>
            <h2 className="mt-3 text-sm font-semibold leading-6 text-ink">
              {step}
            </h2>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
        {[
          "Deterministic analysis",
          "Evidence-backed insights",
          "AI optional",
          "Source URLs",
          "Confidence levels",
          "Noise ignored",
          "Unknown beats false",
        ].map((point) => (
          <div
            key={point}
            className="rounded-md bg-white px-4 py-3 text-sm font-semibold text-ink/70 shadow-soft"
          >
            {point}
          </div>
        ))}
      </section>

      <section aria-label="LaunchRadar preview" className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between border-b border-ink/10 pb-4">
          <div>
            <p className="text-sm font-semibold text-ink">
              Cached public-page examples
            </p>
            <p className="text-xs text-ink/55">
              {demoCache.updated_at
                ? `Updated ${formatDateTime(demoCache.updated_at)}`
                : "Waiting for first refresh"}
            </p>
          </div>
          <div className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">
            Verified
          </div>
        </div>
        {demoCache.examples.length ? (
          <div className="grid gap-4 py-5 md:grid-cols-3">
            {demoCache.examples.map((example) => (
              <article
                key={example.source_url}
                className="rounded-md border border-ink/10 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <a
                    href={example.site_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-ink transition hover:text-moss"
                  >
                    {example.name}
                  </a>
                  <span className="rounded-full bg-paper px-2 py-1 text-xs font-semibold text-ink/55">
                    {example.confidence}
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink/70">
                  {example.positioning}
                </p>
                <div className="mt-3 space-y-2 text-xs text-ink/60">
                  <p>
                    <span className="font-semibold text-ink">Pricing:</span>{" "}
                    {example.pricing}
                  </p>
                  <p>
                    <span className="font-semibold text-ink">CTA:</span>{" "}
                    {example.cta}
                  </p>
                </div>
                <p className="mt-3 text-xs leading-5 text-ink/60">
                  Verified from public page.{" "}
                  <a
                    href={example.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-moss hover:text-moss/80"
                  >
                    Source
                  </a>
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="py-5 text-sm leading-6 text-ink/65">
            Cached examples are not available yet. LaunchRadar will show only
            verified public-page examples after the first refresh succeeds.
          </p>
        )}
      </section>
    </main>
  );
}
