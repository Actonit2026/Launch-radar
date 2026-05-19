type SetupNeededProps = {
  title?: string;
  message: string;
};

export function SetupNeeded({
  title = "Connect Supabase",
  message,
}: SetupNeededProps) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-3xl items-center px-6 py-12">
      <section className="w-full rounded-lg border border-ink/10 bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">
          Setup needed
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">{title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink/70">
          {message}
        </p>
        <code className="mt-6 block rounded-md bg-ink px-4 py-3 text-sm leading-6 text-white">
          NEXT_PUBLIC_SUPABASE_URL
          <br />
          NEXT_PUBLIC_SUPABASE_ANON_KEY
          <br />
          supabase/migrations/0001_initial_schema.sql
        </code>
      </section>
    </main>
  );
}
