import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_HOME, ADMIN_LOGIN } from "@/lib/admin/paths";
import type { Database } from "@/types/database";

import { getSupabasePublicEnv } from "./env";

/**
 * Refreshes the Supabase session cookies and guards /admin/*.
 * Only admins (rows in `admins`, checked via `is_admin()`) get through.
 */
export async function updateSession(request: NextRequest) {
  const { url, anonKey } = getSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Must run before anything else so a refreshed token is written to the response.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === ADMIN_LOGIN;

  if (!isLoggedIn) {
    if (isLoginPage) return response;
    // Come back to the same page after logging in.
    return redirectTo(request, response, ADMIN_LOGIN, {
      next: pathname + search,
    });
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isLoginPage) {
    // Already logged in as admin: skip the form.
    return isAdmin ? redirectTo(request, response, ADMIN_HOME) : response;
  }
  if (!isAdmin)
    return redirectTo(request, response, ADMIN_LOGIN, { erro: "sem-acesso" });

  return response;
}

function redirectTo(
  request: NextRequest,
  sessionResponse: NextResponse,
  path: string,
  params: Record<string, string> = {},
) {
  const target = request.nextUrl.clone();
  target.pathname = path;
  target.search = "";
  for (const [key, value] of Object.entries(params))
    target.searchParams.set(key, value);
  const redirect = NextResponse.redirect(target);
  // Keep any refreshed session cookies.
  sessionResponse.cookies
    .getAll()
    .forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
