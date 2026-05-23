import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Supabase = SupabaseClient<Database>;

const bootstrapMasterAdminEmails = ["prop.alpha@proton.me"];

function configuredAdminEmails() {
  return [
    process.env.MASTER_ADMIN_EMAILS ?? "",
    process.env.ADMIN_EMAILS ?? "",
    bootstrapMasterAdminEmails.join(","),
  ]
    .join(",")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isMasterAdminEmail(email?: string | null) {
  return Boolean(
    email && configuredAdminEmails().includes(email.trim().toLowerCase()),
  );
}

export async function isMasterAdminUser({
  supabase,
  userId,
}: {
  supabase: Supabase;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.email) {
    return false;
  }

  return isMasterAdminEmail(data.email);
}
