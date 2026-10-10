import { getSupabasePublicEnv } from "@/lib/supabase/env";
import type { EventType } from "@/types/database";

/**
 * Fire-and-forget metric (PLAN.md §5, phase 2). Goes straight from the browser
 * to the Supabase REST API (RLS allows anonymous inserts of `type` and
 * `product_id`), never through the Worker. `keepalive` lets the request finish
 * when the page navigates away, e.g. right after opening WhatsApp.
 */
export function trackEvent(type: EventType, productId: string | null) {
  try {
    const { url, anonKey } = getSupabasePublicEnv();
    void fetch(`${url}/rest/v1/events`, {
      method: "POST",
      keepalive: true,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ type, product_id: productId }),
    }).catch(() => {});
  } catch {
    // Metrics must never break the page.
  }
}
