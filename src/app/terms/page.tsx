export const metadata = {
  title: "Terms | LaunchRadar",
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">
          Terms
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-ink">
          Informational competitor intelligence.
        </h1>
        <p className="mt-4 text-sm leading-7 text-ink/65">
          LaunchRadar analyzes publicly available website content and presents
          evidence-backed observations. Results are informational and are not
          business, legal, financial, or investment advice.
        </p>
      </section>

      <section className="space-y-4 rounded-lg border border-ink/10 bg-white p-6 text-sm leading-7 text-ink/65">
        <p>
          LaunchRadar does not claim to know a competitor&apos;s private
          strategy, internal roadmap, undisclosed pricing, or confidential
          customer information.
        </p>
        <p>
          Analysis is limited to public page content available at scan time.
          Unknown, unclear, blocked, or JavaScript-heavy pages may produce
          limited results.
        </p>
        <p>
          Users are responsible for how they use LaunchRadar output. Monitored
          site owners can request domain review or removal by contacting{" "}
          <a
            href="mailto:hello@launchradar.app"
            className="font-semibold text-moss hover:text-moss/80"
          >
            hello@launchradar.app
          </a>
          .
        </p>
      </section>
    </main>
  );
}
