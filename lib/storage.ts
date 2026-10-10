import { getSupabasePublicEnv } from "@/lib/supabase/env";

export type PublicBucket = "models" | "images";

/**
 * Public URL of a Storage object. Both buckets are public and file names carry
 * a timestamp, so the URL never changes content (PLAN.md §4).
 */
export function publicUrl(bucket: PublicBucket, path: string): string {
  const { url } = getSupabasePublicEnv();
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${url}/storage/v1/object/public/${bucket}/${encodedPath}`;
}
