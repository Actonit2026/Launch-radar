"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createInitialMonitoringSetup } from "@/lib/scanner";
import { normalizeBaseUrl } from "@/lib/urls";
import { ensureUserProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import {
  isSupabaseConfigured,
  supabaseConfigMessage,
} from "@/lib/supabase/config";

export type CompetitorFormState = {
  error?: string;
  message?: string;
};

type ParsedCompetitorForm =
  | {
      name: string;
      baseUrl: string;
      error?: never;
    }
  | {
      error: string;
      name?: never;
      baseUrl?: never;
    };

function readCompetitorForm(formData: FormData): ParsedCompetitorForm {
  const rawName = String(formData.get("name") ?? "").trim();
  const rawUrl = String(formData.get("baseUrl") ?? "").trim();

  if (!rawUrl) {
    return { error: "Competitor URL is required." };
  }

  try {
    const baseUrl = normalizeBaseUrl(rawUrl);
    const hostname = new URL(baseUrl).hostname.replace(/^www\./, "");
    const name = rawName || hostname;

    return { name, baseUrl };
  } catch {
    return { error: "Enter a valid http or https URL." };
  }
}

function isDuplicateError(code?: string) {
  return code === "23505";
}

export async function createCompetitorAction(
  _previousState: CompetitorFormState,
  formData: FormData,
): Promise<CompetitorFormState> {
  if (!isSupabaseConfigured()) {
    return { error: supabaseConfigMessage };
  }

  const user = await getCurrentUser();

  if (!user) {
    return { error: "Sign in before adding a competitor." };
  }

  const parsed = readCompetitorForm(formData);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const profileError = await ensureUserProfile(supabase, user);

  if (profileError) {
    return { error: profileError };
  }

  const { data: competitor, error: competitorError } = await supabase
    .from("competitors")
    .insert({
      user_id: user.id,
      name: parsed.name,
      base_url: parsed.baseUrl,
    })
    .select("id")
    .single();

  if (competitorError) {
    if (isDuplicateError(competitorError.code)) {
      return { error: "That competitor is already being tracked." };
    }

    return { error: competitorError.message };
  }

  const setup = await createInitialMonitoringSetup(
    supabase,
    competitor.id,
    parsed.baseUrl,
  );

  if (setup.error) {
    await supabase
      .from("competitors")
      .delete()
      .eq("id", competitor.id)
      .eq("user_id", user.id);

    return { error: setup.error };
  }

  revalidatePath("/dashboard");

  const snapshotMessage = setup.data?.snapshotsCreated
    ? ` Created ${setup.data.snapshotsCreated} baseline snapshots.`
    : "";

  return { message: `${parsed.name} is now tracked.${snapshotMessage}` };
}

export async function deleteCompetitorAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const competitorId = String(formData.get("competitorId") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");

  if (competitorId) {
    const supabase = await createClient();
    await supabase
      .from("competitors")
      .delete()
      .eq("id", competitorId)
      .eq("user_id", user.id);
  }

  revalidatePath("/dashboard");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
}
