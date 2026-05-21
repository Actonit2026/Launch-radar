import Link from "next/link";
import { redirect } from "next/navigation";
import { IntelligenceSnapshotPanel } from "@/components/intelligence-snapshot-panel";
import { ProductRecommendationsPanel } from "@/components/product-recommendations-panel";
import { SetupNeeded } from "@/components/setup-needed";
import { UserProductForm } from "@/components/user-product-form";
import { getCurrentUser } from "@/lib/auth";
import { ProductRecommendation } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";
import {
  buildIntelligenceDisplay,
  parseIntelligenceSnapshot,
} from "@/lib/intelligence/display";
import { ensureUserProfile } from "@/lib/profiles";
import {
  isSupabaseConfigured,
  supabaseConfigMessage,
} from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Your Product | LaunchRadar",
};

export default async function YourProductPage() {
  if (!isSupabaseConfigured()) {
    return <SetupNeeded message={supabaseConfigMessage} />;
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const profileError = await ensureUserProfile(supabase, user);

  if (profileError) {
    return (
      <SetupNeeded
        title="Profile setup needed"
        message={profileError}
      />
    );
  }

  const [
    { data: product, error: productError },
    { count: competitorCount, error: competitorCountError },
  ] = await Promise.all([
    supabase
      .from("user_products")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("competitors")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  if (productError || competitorCountError) {
    return (
      <SetupNeeded
        title="Could not load product analysis"
        message={productError?.message ?? competitorCountError?.message ?? ""}
      />
    );
  }

  const { data: snapshot } = product
    ? await supabase
        .from("product_snapshots")
        .select("*")
        .eq("user_product_id", product.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const { data: recommendations } = product
    ? await supabase
        .from("product_recommendations")
        .select("*")
        .eq("user_product_id", product.id)
        .eq("user_id", user.id)
        .order("confidence", { ascending: false })
        .order("created_at", { ascending: false })
    : { data: [] };
  const display = buildIntelligenceDisplay(parseIntelligenceSnapshot(snapshot));

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-moss">
              LaunchRadar
            </p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">
              Your Product
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Compare your own public positioning, pricing visibility, CTAs, and
              feature signals against tracked competitors.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/35"
            >
              Competitors
            </Link>
            <Link
              href="/dashboard/settings"
              className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-white px-5 text-sm font-semibold text-ink transition hover:border-ink/35"
            >
              Settings
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <UserProductForm
            product={
              product
                ? {
                    id: product.id,
                    name: product.name,
                    baseUrl: product.base_url,
                    scanStatus: product.scan_status,
                  }
                : null
            }
          />

          {product ? (
            <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
              <h2 className="text-xl font-semibold text-ink">Status</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="font-medium text-ink/55">Website</dt>
                  <dd className="mt-1 text-ink">{product.base_url}</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink/55">Last scanned</dt>
                  <dd className="mt-1 text-ink">
                    {product.last_scanned_at
                      ? formatDateTime(product.last_scanned_at)
                      : "Not scanned yet"}
                  </dd>
                </div>
                {product.error_message ? (
                  <div>
                    <dt className="font-medium text-ink/55">Latest error</dt>
                    <dd className="mt-1 text-red-600">
                      {product.error_message}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
            <h2 className="text-xl font-semibold text-ink">Product Snapshot</h2>
            {display ? (
              <IntelligenceSnapshotPanel display={display} />
            ) : (
              <p className="mt-3 rounded-md bg-paper p-4 text-sm leading-6 text-ink/65">
                Add your product URL to create the first evidence-backed
                baseline snapshot.
              </p>
            )}
          </div>

          <ProductRecommendationsPanel
            recommendations={(recommendations ?? []) as ProductRecommendation[]}
            competitorCount={competitorCount ?? 0}
          />
        </div>
      </section>
    </main>
  );
}
