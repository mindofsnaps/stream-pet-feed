import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the SECRET (service_role) key.
 *
 * - Bypasses RLS — full read/write access. Only ever used server-side (admin
 *   reads/writes, signed-upload minting, the public feed read).
 * - NEVER import this from a client component — `import "server-only"` makes
 *   that a build-time error.
 *
 * Both values come from your Supabase project (Settings → API):
 *   NEXT_PUBLIC_SUPABASE_URL      = Project URL
 *   SUPABASE_SERVICE_ROLE_KEY     = service_role secret (NOT the anon key)
 */
export function createServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase config missing — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
