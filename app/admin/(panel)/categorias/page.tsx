import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { createClient } from "@/lib/supabase/server";

import { CategoryManager } from "./category-manager";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order, products(count)")
    .order("sort_order")
    .order("name");
  if (error) throw error;

  const categories = data.map(({ products, ...category }) => ({
    ...category,
    productCount: products[0]?.count ?? 0,
  }));

  return (
    <>
      <PageHeader title="Categorias">
        <p className="text-base text-muted-foreground">
          Aparecem no menu da loja nesta ordem. Arraste pelo{" "}
          <span aria-hidden>⋮⋮</span> para mudar.
        </p>
      </PageHeader>
      <CategoryManager initial={categories} />
    </>
  );
}
