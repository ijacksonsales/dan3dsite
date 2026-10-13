import "server-only";

import { cache } from "react";

import { containsPattern } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

// Public store reads. RLS already limits anonymous users to published
// products, active banners in their window, and images of published products.

const CARD_FIELDS =
  "id, name, slug, price_cents, height_mm, width_mm, depth_mm, made_to_order, product_images(path, alt, sort_order)";

type ImageRow = Pick<Tables<"product_images">, "path" | "alt" | "sort_order">;

export type ProductCardData = Pick<
  Tables<"products">,
  | "id"
  | "name"
  | "slug"
  | "price_cents"
  | "height_mm"
  | "width_mm"
  | "depth_mm"
  | "made_to_order"
> & { cover: { path: string; alt: string | null } | null };

type CardRow = Omit<ProductCardData, "cover"> & {
  product_images: ImageRow[];
};

function toCard({ product_images, ...product }: CardRow): ProductCardData {
  const [cover] = [...product_images].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return {
    ...product,
    cover: cover ? { path: cover.path, alt: cover.alt } : null,
  };
}

function cards(rows: CardRow[] | null): ProductCardData[] {
  return (rows ?? []).map(toCard);
}

export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("store_name, whatsapp_number, instagram_url, about_text")
    .eq("id", 1)
    .maybeSingle();
  return data;
});

export const getCategories = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("sort_order")
    .order("name");
  return data ?? [];
});

export async function getActiveBanners() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("banners")
    .select(
      "id, title, subtitle, image_desktop_path, image_mobile_path, link_url",
    )
    .order("sort_order");
  return data ?? [];
}

export async function getFeaturedProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(CARD_FIELDS)
    .eq("status", "published")
    .eq("featured", true)
    .order("featured_order", { nullsFirst: false })
    .limit(12);
  return cards(data);
}

export async function getRecentProducts(limit = 8) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(CARD_FIELDS)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  return cards(data);
}

export const getCategoryBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

export async function getProductsByCategory(categoryId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(CARD_FIELDS)
    .eq("status", "published")
    .eq("category_id", categoryId)
    .order("created_at", { ascending: false });
  return cards(data);
}

export async function searchProducts(term: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(CARD_FIELDS)
    .eq("status", "published")
    .ilike("name", containsPattern(term))
    .order("name")
    .limit(48);
  return cards(data);
}

export const getProductBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, slug, description, price_cents, height_mm, width_mm, depth_mm, model_path, model_usdz_path, poster_path, ar_placement, made_to_order, categories(name, slug), product_images(path, alt, sort_order)",
    )
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const images = [...data.product_images].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return { ...data, product_images: images };
});

export type ProductDetail = NonNullable<
  Awaited<ReturnType<typeof getProductBySlug>>
>;

export async function getSitemapEntries() {
  const supabase = await createClient();
  const [products, categories] = await Promise.all([
    supabase
      .from("products")
      .select("slug, updated_at")
      .eq("status", "published"),
    supabase.from("categories").select("slug"),
  ]);
  return {
    products: products.data ?? [],
    categories: categories.data ?? [],
  };
}
