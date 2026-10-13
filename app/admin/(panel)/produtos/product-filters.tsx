"use client";

import { LoaderCircleIcon, SearchIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { inputClassName } from "@/components/admin/form";
import { NO_CATEGORY, type StatusFilter } from "@/lib/admin/products";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "published", label: "Publicados" },
  { value: "draft", label: "Rascunhos" },
];

export function ProductFilters({
  q,
  status,
  categoryId,
  categories,
}: {
  q: string;
  status: StatusFilter;
  categoryId: string;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(q);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The filters live in the URL, so "back" from a product keeps them.
  function apply(changes: Record<string, string>) {
    const params = new URLSearchParams({
      q: search.trim(),
      status: status === "all" ? "" : status,
      categoria: categoryId,
      ...changes,
    });
    for (const [key, value] of [...params]) if (!value) params.delete(key);
    const query = params.toString();
    startTransition(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      }),
    );
  }

  useEffect(() => () => clearTimeout(debounce.current), []);

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(event) => {
            const value = event.target.value;
            setSearch(value);
            clearTimeout(debounce.current);
            debounce.current = setTimeout(
              () => apply({ q: value.trim() }),
              350,
            );
          }}
          placeholder="Buscar pelo nome"
          aria-label="Buscar produto pelo nome"
          enterKeyHint="search"
          className={cn(inputClassName, "pr-12 pl-12")}
        />
        {pending && (
          <LoaderCircleIcon className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div
          role="group"
          aria-label="Situação"
          className="grid flex-1 grid-cols-3 rounded-xl bg-secondary p-1"
        >
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={status === option.value}
              onClick={() =>
                apply({ status: option.value === "all" ? "" : option.value })
              }
              className={cn(
                "min-h-11 rounded-lg px-2 text-base font-medium transition-colors",
                status === option.value
                  ? "bg-card shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <select
          value={categoryId}
          onChange={(event) => apply({ categoria: event.target.value })}
          aria-label="Categoria"
          className={cn(inputClassName, "sm:w-60")}
        >
          <option value="">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value={NO_CATEGORY}>Sem categoria</option>
        </select>
      </div>
    </div>
  );
}
