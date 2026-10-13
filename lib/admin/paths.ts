export const ADMIN_HOME = "/admin";
export const ADMIN_LOGIN = "/admin/login";

/**
 * Where to go after logging in. Only admin pages are accepted, so a crafted
 * `?next=` link cannot send the user to another site.
 */
export function safeAdminPath(next: string | null | undefined): string {
  if (!next || next.startsWith("//") || next.includes("\\")) return ADMIN_HOME;
  const isAdminPath = next === ADMIN_HOME || next.startsWith(`${ADMIN_HOME}/`);
  if (!isAdminPath || next.startsWith(ADMIN_LOGIN)) return ADMIN_HOME;
  return next;
}
