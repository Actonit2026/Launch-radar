export const metadata = {
  title: "Privacy | LaunchRadar",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">
          Privacy
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-ink">
          Public-data monitoring with limited retention.
        </h1>
        <p className="mt-4 text-sm leading-7 text-ink/65">
          LaunchRadar stores account information, tracked competitor URLs,
          public-page analysis metadata, structured facts, short evidence
          excerpts, usage events, and billing status needed to run the service.
        </p>
      </section>

      <section className="space-y-4 rounded-lg border border-ink/10 bg-white p-6 text-sm leading-7 text-ink/65">
        <p>
          LaunchRadar does not intentionally collect private competitor data,
          login-only content, checkout data, or paywalled content.
        </p>
        <p>
          Public page snapshots are retained only as needed for monitoring and
          reliability. The app prefers structured facts, hashes, source URLs,
          and short evidence excerpts over indefinite full-page storage.
        </p>
        <p>
          You can request account deletion or ask about domain removal at{" "}
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
