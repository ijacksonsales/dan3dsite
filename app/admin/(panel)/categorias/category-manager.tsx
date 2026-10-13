"use client";

import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StickyActions, primaryButtonClassName } from "@/components/admin/form";
import { SortableList } from "@/components/admin/sortable-list";
import { useToast } from "@/components/admin/toast";
import { orderUpdates } from "@/lib/admin/reorder";
import { createClient } from "@/lib/supabase/client";

import { CategoryDialog } from "./category-dialog";

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  productCount: number;
}

export function CategoryManager({ initial }: { initial: AdminCategory[] }) {
  const router = useRouter();
  const toast = useToast();
  const [categories, setCategories] = useState(initial);
  const [savingOrder, setSavingOrder] = useState(false);
  // undefined: closed · null: new category · object: editing it.
  const [editing, setEditing] = useState<AdminCategory | null | undefined>();

  // Server data changed (after router.refresh()): start from it again.
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setCategories(initial);
  }

  async function reorder(next: AdminCategory[]) {
    const previous = categories;
    setCategories(next);
    setSavingOrder(true);
    const supabase = createClient();
    const results = await Promise.all(
      orderUpdates(next, (category) => category.sort_order).map(
        ({ id, order }) =>
          supabase
            .from("categories")
            .update({ sort_order: order })
            .eq("id", id)
            .select("id"),
      ),
    );
    setSavingOrder(false);
    if (results.some(({ error, data }) => error || !data?.length)) {
      setCategories(previous);
      toast(
        "Não foi possível salvar a nova ordem. Confira a internet e tente de novo.",
        "error",
      );
      router.refresh();
      return;
    }
    setCategories(
      next.map((category, order) => ({ ...category, sort_order: order })),
    );
    toast("Ordem salva.");
    router.refresh();
  }

  return (
    <>
      {categories.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-base text-muted-foreground">
          Nenhuma categoria ainda. Toque em “Nova categoria” para criar a
          primeira.
        </p>
      ) : (
        <SortableList
          items={categories}
          getLabel={(category) => category.name}
          onReorder={reorder}
          disabled={savingOrder}
          renderItem={(category, handle) => (
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-2">
              {handle}
              <button
                type="button"
                onClick={() => setEditing(category)}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-medium">
                    {category.name}
                  </span>
                  <span className="block text-base text-muted-foreground">
                    {category.productCount === 0
                      ? "Nenhuma peça"
                      : category.productCount === 1
                        ? "1 peça"
                        : `${category.productCount} peças`}
                  </span>
                </span>
                <span className="sr-only">Editar</span>
                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
              </button>
            </div>
          )}
        />
      )}

      <StickyActions>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className={`${primaryButtonClassName} sm:ml-auto sm:w-auto sm:min-w-56`}
        >
          <PlusIcon className="size-5" />
          Nova categoria
        </button>
      </StickyActions>

      {editing !== undefined && (
        <CategoryDialog
          category={editing}
          nextSortOrder={
            Math.max(-1, ...categories.map((category) => category.sort_order)) +
            1
          }
          onClose={() => setEditing(undefined)}
          onSaved={(message) => {
            setEditing(undefined);
            toast(message);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
