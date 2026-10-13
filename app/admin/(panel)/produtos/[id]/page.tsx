import { ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form/product-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Editar produto" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({
  params,
}: PageProps<"/admin/produtos/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: product, error }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "name, slug, description, category_id, price_cents, height_mm, width_mm, depth_mm, made_to_order, ar_placement, status, model_path, model_source_path, model_usdz_path, poster_path, updated_at, product_images(id, path, alt, sort_order)",
      )
      .eq("id", id)
      .order("sort_order", { referencedTable: "product_images" })
      .maybeSingle(),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);
  if (error) throw error;
  if (!product) notFound();

  const { product_images: images, updated_at: version, ...initial } = product;

  return (
    <>
      <PageHeader
        title={product.name}
        backHref="/admin/produtos"
        backLabel="Produtos"
      >
        {product.status === "published" && (
          <Link
            href={`/p/${product.slug}`}
            target="_blank"
            className="-ml-1 inline-flex min-h-12 items-center gap-2 rounded-full px-1 text-base font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver na loja
            <ExternalLinkIcon className="size-4" />
          </Link>
        )}
      </PageHeader>
      <ProductForm
        // A new version from the server (after saving) starts the form fresh.
        key={version}
        productId={id}
        isNew={false}
        categories={categories ?? []}
        initial={{ ...initial, images }}
      />
    </>
  );
}
