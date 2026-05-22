export const metadata = {
  title: "LaunchRadar Bot",
};

export default function BotPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">
          LaunchRadarBot
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-ink">
          Public page analysis, with restraint.
        </h1>
        <p className="mt-4 text-sm leading-7 text-ink/65">
          LaunchRadarBot visits publicly available marketing, pricing,
          product, documentation, and update pages so LaunchRadar users can
          monitor evidence-backed competitor changes.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {[
          "We analyze public pages only.",
          "We do not bypass logins, paywalls, checkout, account, or admin pages.",
          "We respect robots.txt where feasible.",
          "We store hashes, metadata, structured facts, and short evidence excerpts.",
        ].map((item) => (
          <div key={item} className="rounded-md border border-ink/10 bg-white p-4">
            <p className="text-sm leading-6 text-ink/70">{item}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-6">
        <h2 className="text-xl font-semibold text-ink">Contact or opt out</h2>
        <p className="mt-3 text-sm leading-7 text-ink/65">
          Site owners can request removal or ask questions at{" "}
          <a
            href="mailto:hello@launchradar.app"
            className="font-semibold text-moss hover:text-moss/80"
          >
            hello@launchradar.app
          </a>
          . Include the domain and any relevant details.
        </p>
      </section>
    </main>
  );
}
