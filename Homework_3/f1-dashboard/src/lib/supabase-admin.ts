import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-only writes (sync jobs, cron routes).
 * The anon client in `supabase.ts` is RLS-gated to `select` only.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (see .env.local.example) — get it from the Supabase dashboard under Project Settings -> API."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
