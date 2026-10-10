import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductGrid } from "@/components/store/product-card";
import { EmptyState } from "@/components/store/section";
import { getCategoryBySlug, getProductsByCategory } from "@/lib/store/queries";

export async function generateMetadata({
  params,
}: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  return {
    title: category.name,
    description: `Peças ${category.name.toLowerCase()} impressas em 3D. Veja em tamanho real no seu espaço.`,
    alternates: { canonical: `/c/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const products = await getProductsByCategory(category.id);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8">
      <p className="font-heading text-xs tracking-[0.25em] text-muted-foreground uppercase">
        Categoria
      </p>
      <h1 className="mt-1 font-heading text-3xl tracking-wide sm:text-4xl">
        {category.name}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {products.length === 1 ? "1 peça" : `${products.length} peças`}
      </p>
      <div className="mt-8">
        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <EmptyState title="Nenhuma peça aqui ainda">
            Novas peças desta categoria chegam em breve.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
