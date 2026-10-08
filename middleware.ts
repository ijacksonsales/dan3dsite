import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Kept as `middleware.ts` (edge runtime) instead of Next 16's `proxy.ts`:
// Node.js proxy is experimental on @opennextjs/cloudflare. See docs/decisions.md.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only the admin needs auth; the public store skips this to save Worker CPU.
  matcher: ["/admin/:path*"],
};
