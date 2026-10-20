import { PencilRulerIcon, SearchIcon } from "lucide-react";
import Link from "next/link";

import { getCategories } from "@/lib/store/queries";

import { BrandLogo } from "./brand-logo";
import { CategoryNav } from "./category-nav";
import { SearchForm } from "./search-form";

export async function StoreHeader() {
  const categories = await getCategories();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          aria-label="DAN3D, página inicial"
          className="flex min-h-12 items-center"
        >
          <BrandLogo priority />
        </Link>
        <SearchForm className="ml-auto hidden max-w-sm md:flex" />
        <Link
          href="/busca"
          aria-label="Buscar peças"
          className="ml-auto grid size-12 place-items-center rounded-full hover:bg-secondary md:hidden"
        >
          <SearchIcon className="size-5" />
        </Link>
        <Link
          href="/orcamento"
          className="-mr-2 inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium hover:bg-secondary md:-mr-3"
        >
          <PencilRulerIcon className="size-5 text-primary" />
          Orçamento
        </Link>
      </div>
      <CategoryNav categories={categories} />
    </header>
  );
}
