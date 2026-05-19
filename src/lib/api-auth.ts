import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function getAuthenticatedContext(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
    const supabase = createSupabaseClient<Database>(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user ? { supabase, user } : null;
  }

  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return {
    supabase: await createClient(),
    user,
  };
}
