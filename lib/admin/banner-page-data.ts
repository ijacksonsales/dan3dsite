import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Link choices for the banner form, plus where a new banner goes. */
export async function bannerFormOptions() {
  const supabase = await createClient();
  const [products, categories, last] = await Promise.all([
    supabase.from("products").select("slug, name").order("name"),
    supabase.from("categories").select("slug, name").order("sort_order"),
    supabase
      .from("banners")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    products: products.data ?? [],
    categories: categories.data ?? [],
    nextSortOrder: (last.data?.sort_order ?? -1) + 1,
  };
}
