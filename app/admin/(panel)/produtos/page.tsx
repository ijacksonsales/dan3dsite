import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StickyActions, primaryButtonClassName } from "@/components/admin/form";
import { PageHeader } from "@/components/admin/page-header";
import { NO_CATEGORY, type StatusFilter } from "@/lib/admin/products";
import { containsPattern } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

import { ProductFilters } from "./product-filters";
import { ProductRow } from "./product-row";

export const metadata: Metadata = { title: "Produtos" };

export default async function ProductsPage({
  searchParams,
}: PageProps<"/admin/produtos">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const status: StatusFilter =
    params.status === "draft" || params.status === "published"
      ? params.status
      : "all";
  const categoryId =
    typeof params.categoria === "string" ? params.categoria : "";

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(
      "id, name, status, featured, price_cents, categories(name), product_images(path, sort_order)",
    )
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" });
  if (q) query = query.ilike("name", containsPattern(q));
  if (status !== "all") query = query.eq("status", status);
  if (categoryId === NO_CATEGORY) query = query.is("category_id", null);
  else if (categoryId) query = query.eq("category_id", categoryId);

  const [{ data: products, error }, { data: categories }] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);
  if (error) throw error;

  const filtered = Boolean(q || status !== "all" || categoryId);

  return (
    <>
      <PageHeader title="Produtos" />
      <ProductFilters
        q={q}
        status={status}
        categoryId={categoryId}
        categories={categories ?? []}
      />

      {products.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-base text-muted-foreground">
          {filtered
            ? "Nenhum produto encontrado com esses filtros."
            : "Nenhum produto ainda. Toque em “Novo produto” para cadastrar o primeiro."}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {products.map((product) => (
            <li key={product.id}>
              <ProductRow
                product={{
                  id: product.id,
                  name: product.name,
                  status: product.status,
                  featured: product.featured,
                  price_cents: product.price_cents,
                  categoryName: product.categories?.name ?? null,
                  coverPath: product.product_images[0]?.path ?? null,
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <StickyActions>
        <Link
          href="/admin/produtos/novo"
          className={`${primaryButtonClassName} sm:ml-auto sm:w-auto sm:min-w-56`}
        >
          <PlusIcon className="size-5" />
          Novo produto
        </Link>
      </StickyActions>
    </>
  );
}
