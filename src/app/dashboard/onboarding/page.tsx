import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupNeeded } from "@/components/setup-needed";
import { getCurrentUser } from "@/lib/auth";
import {
  isSupabaseConfigured,
  supabaseConfigMessage,
} from "@/lib/supabase/config";

export const metadata = {
  title: "Start | LaunchRadar",
};

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) {
    return <SetupNeeded message={supabaseConfigMessage} />;
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">
          First useful insight
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-ink">
          What do you want to do first?
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/65">
          You do not need a live product to use LaunchRadar. Start by tracking
          competitors, then add your product later when you want tailored
          recommendations.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="rounded-lg border border-moss/20 bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-semibold text-ink">
            Track competitors
          </h2>
          <p className="mt-3 text-sm leading-7 text-ink/65">
            See how competitors position, price, and evolve. Add one competitor
            URL and LaunchRadar will create the first evidence-backed baseline.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-moss px-5 text-sm font-semibold text-white transition hover:bg-moss/90"
          >
            Track competitors
          </Link>
        </article>

        <article className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
          <h2 className="text-2xl font-semibold text-ink">
            Analyze my product
          </h2>
          <p className="mt-3 text-sm leading-7 text-ink/65">
            Add your product URL to compare its public pricing visibility,
            positioning, CTAs, and feature signals against tracked competitors.
          </p>
          <Link
            href="/dashboard/your-product"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/35"
          >
            Analyze my product
          </Link>
        </article>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-6">
        <h2 className="text-xl font-semibold text-ink">Pre-launch mode</h2>
        <p className="mt-3 text-sm leading-7 text-ink/65">
          Validating an idea, researching a category, or preparing a launch is
          enough. Start with competitors now. Personalized recommendations can
          come later when you have a product page to compare.
        </p>
      </section>
    </main>
  );
}
