import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { createClient } from "@/lib/supabase/server";

import { FeaturedManager } from "./featured-manager";

export const metadata: Metadata = { title: "Destaques" };

/** How many highlights the store home shows (lib/store/queries.ts). */
const STORE_LIMIT = 12;

export default async function FeaturedPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, status, featured, featured_order, product_images(path, sort_order)",
    )
    .order("featured_order", { nullsFirst: false })
    .order("name")
    .order("sort_order", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" });
  if (error) throw error;

  const products = data.map(({ product_images, ...product }) => ({
    ...product,
    coverPath: product_images[0]?.path ?? null,
  }));

  return (
    <>
      <PageHeader title="Destaques">
        <p className="text-base text-muted-foreground">
          Peças da faixa “Destaques” na página inicial, nesta ordem. A loja
          mostra as {STORE_LIMIT} primeiras. Arraste pelo{" "}
          <span aria-hidden>⋮⋮</span> para mudar.
        </p>
      </PageHeader>
      <FeaturedManager
        featured={products.filter((product) => product.featured)}
        others={products.filter((product) => !product.featured)}
        storeLimit={STORE_LIMIT}
      />
    </>
  );
}
