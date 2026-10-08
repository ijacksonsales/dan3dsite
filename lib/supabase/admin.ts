import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { getSupabasePublicEnv } from "./env";

/**
 * Service-role client: bypasses RLS. Server-only, use sparingly and never for
 * anything a regular admin session can do. The key is a Worker secret
 * (`wrangler secret put SUPABASE_SERVICE_ROLE_KEY`; locally in .dev.vars).
 */
export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
