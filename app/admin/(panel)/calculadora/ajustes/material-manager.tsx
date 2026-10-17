"use client";

import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SortableList } from "@/components/admin/sortable-list";
import { useToast } from "@/components/admin/toast";
import { orderUpdates } from "@/lib/admin/reorder";
import { materialCost } from "@/lib/costs/calculate";
import type { AdminMaterial } from "@/lib/costs/data";
import { formatMoney } from "@/lib/costs/inputs";
import { createClient } from "@/lib/supabase/client";

import { CATEGORY_LABEL, MaterialDialog } from "./material-dialog";

export function MaterialManager({ initial }: { initial: AdminMaterial[] }) {
  const router = useRouter();
  const toast = useToast();
  const [materials, setMaterials] = useState(initial);
  const [savingOrder, setSavingOrder] = useState(false);
  // undefined: closed · null: new material · object: editing it.
  const [editing, setEditing] = useState<AdminMaterial | null | undefined>();

  // Server data changed (after router.refresh()): start from it again.
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setMaterials(initial);
  }

  async function reorder(next: AdminMaterial[]) {
    const previous = materials;
    setMaterials(next);
    setSavingOrder(true);
    const supabase = createClient();
    const results = await Promise.all(
      orderUpdates(next, (material) => material.sort_order).map(
        ({ id, order }) =>
          supabase
            .from("materials")
            .update({ sort_order: order })
            .eq("id", id)
            .select("id"),
      ),
    );
    setSavingOrder(false);
    if (results.some(({ error, data }) => error || !data?.length)) {
      setMaterials(previous);
      toast(
        "Não foi possível salvar a nova ordem. Confira a internet e tente de novo.",
        "error",
      );
      router.refresh();
      return;
    }
    setMaterials(
      next.map((material, order) => ({ ...material, sort_order: order })),
    );
    toast("Ordem salva.");
    router.refresh();
  }

  return (
    <section id="materiais" className="mt-10 scroll-mt-20 space-y-4">
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-medium">
          Embalagem e materiais
        </h2>
        <p className="text-base text-muted-foreground">
          O que vocês compram em pacote. A calculadora divide o valor pelas
          unidades e cobra só o custo, sem lucro. Arraste pelo{" "}
          <span aria-hidden>⋮⋮</span> para mudar a ordem.
        </p>
      </div>

      {materials.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-base text-muted-foreground">
          Nenhum material ainda.
        </p>
      ) : (
        <SortableList
          items={materials}
          getLabel={(material) => material.name}
          onReorder={reorder}
          disabled={savingOrder}
          renderItem={(material, handle) => (
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-2">
              {handle}
              <button
                type="button"
                onClick={() => setEditing(material)}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-medium">
                    {material.name}
                  </span>
                  <span className="block text-base text-muted-foreground">
                    {CATEGORY_LABEL[material.category]} ·{" "}
                    {formatMoney(materialCost(material, 1))} cada
                    {material.used_by_default ? " · já vem marcado" : ""}
                  </span>
                </span>
                <span className="sr-only">Editar</span>
                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
              </button>
            </div>
          )}
        />
      )}

      <button
        type="button"
        onClick={() => setEditing(null)}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-input bg-card px-6 text-base font-medium hover:bg-muted"
      >
        <PlusIcon className="size-5" />
        Novo material
      </button>

      {editing !== undefined && (
        <MaterialDialog
          material={editing}
          nextSortOrder={
            Math.max(-1, ...materials.map((material) => material.sort_order)) +
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
    </section>
  );
}
