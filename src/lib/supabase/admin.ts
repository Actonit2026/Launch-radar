import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getSupabaseConfig } from "@/lib/supabase/config";

let adminClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  if (!adminClient) {
    const { supabaseUrl } = getSupabaseConfig();

    adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
