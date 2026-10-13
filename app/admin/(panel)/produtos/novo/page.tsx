import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form/product-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");

  return (
    <>
      <PageHeader
        title="Novo produto"
        backHref="/admin/produtos"
        backLabel="Produtos"
      />
      <ProductForm
        // Files are uploaded under the product id before the row exists.
        productId={crypto.randomUUID()}
        isNew
        categories={categories ?? []}
        initial={{
          name: "",
          slug: "",
          description: null,
          category_id: null,
          price_cents: null,
          height_mm: null,
          width_mm: null,
          depth_mm: null,
          made_to_order: true,
          ar_placement: "floor",
          status: "draft",
          model_path: null,
          model_source_path: null,
          model_usdz_path: null,
          poster_path: null,
          images: [],
        }}
      />
    </>
  );
}
