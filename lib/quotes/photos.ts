import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { MAX_QUOTE_PHOTOS } from "./form";
import { PHOTO_RETENTION_DAYS, quotePhotoPath } from "./status";

type Client = SupabaseClient<Database>;

/** Deletes every photo a request may have (missing files are ignored). */
export async function removeQuotePhotos(supabase: Client, requestId: string) {
  const paths = Array.from({ length: MAX_QUOTE_PHOTOS }, (_, index) =>
    quotePhotoPath(requestId, index),
  );
  const { error } = await supabase.storage.from("quotes").remove(paths);
  return !error;
}

/**
 * Photos of requests archived more than PHOTO_RETENTION_DAYS ago are deleted,
 * so the private bucket does not grow forever. Runs from the admin's session
 * whenever she archives a request; a failure is retried next time.
 */
export async function removeExpiredQuotePhotos(supabase: Client) {
  const cutoff = new Date(
    Date.now() - PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data } = await supabase
    .from("quote_requests")
    .select("id")
    .eq("status", "archived")
    .eq("photos_removed", false)
    .lt("archived_at", cutoff)
    .limit(20);
  for (const { id } of data ?? []) {
    if (await removeQuotePhotos(supabase, id)) {
      await supabase
        .from("quote_requests")
        .update({ photos_removed: true })
        .eq("id", id);
    }
  }
}
