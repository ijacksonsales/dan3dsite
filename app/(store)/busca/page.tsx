import type { Metadata } from "next";
import Link from "next/link";

import { ProductGrid } from "@/components/store/product-card";
import { SearchForm } from "@/components/store/search-form";
import { EmptyState } from "@/components/store/section";
import { searchProducts } from "@/lib/store/queries";

export const metadata: Metadata = {
  title: "Buscar peças",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: PageProps<"/busca">) {
  const { q } = await searchParams;
  const term = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 80) ?? "";
  const results = term ? await searchProducts(term) : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8">
      <h1 className="font-heading text-3xl tracking-wide">Buscar peças</h1>
      <SearchForm
        defaultValue={term}
        autoFocus={!term}
        className="mt-5 max-w-xl"
      />
      {term && (
        <div className="mt-8">
          <p className="mb-6 text-sm text-muted-foreground" aria-live="polite">
            {results.length === 0
              ? `Nada encontrado para “${term}”.`
              : results.length === 1
                ? `1 peça para “${term}”`
                : `${results.length} peças para “${term}”`}
          </p>
          {results.length > 0 ? (
            <ProductGrid products={results} />
          ) : (
            <EmptyState title="Não achamos essa peça">
              <p>
                Tente outra palavra, ou peça um orçamento: fazemos sob medida.
              </p>
              <Link
                href="/orcamento"
                className="mt-4 inline-flex min-h-12 items-center rounded-full bg-primary px-6 text-base font-medium text-primary-foreground hover:bg-espresso"
              >
                Pedir orçamento personalizado
              </Link>
            </EmptyState>
          )}
        </div>
      )}
    </div>
  );
}
