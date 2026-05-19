import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { formatDatabaseError } from "@/lib/errors";

export async function ensureUserProfile(
  supabase: SupabaseClient<Database>,
  user: User,
) {
  const { error } = await supabase.from("users").upsert(
    {
      id: user.id,
      email: user.email ?? "",
    },
    { onConflict: "id" },
  );

  return error ? formatDatabaseError(error.message) : null;
}
