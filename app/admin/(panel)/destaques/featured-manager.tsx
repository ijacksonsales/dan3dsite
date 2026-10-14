"use client";

import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  StickyActions,
  inputClassName,
  primaryButtonClassName,
} from "@/components/admin/form";
import { ProductThumb } from "@/components/admin/product-thumb";
import { SortableList } from "@/components/admin/sortable-list";
import { useToast } from "@/components/admin/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orderUpdates } from "@/lib/admin/reorder";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProductStatus } from "@/types/database";

interface FeaturedProduct {
  id: string;
  name: string;
  status: ProductStatus;
  featured_order: number | null;
  coverPath: string | null;
}

const ERROR = "Não foi possível salvar. Confira a internet e tente de novo.";

export function FeaturedManager({
  featured: initialFeatured,
  others,
  storeLimit,
}: {
  featured: FeaturedProduct[];
  others: FeaturedProduct[];
  storeLimit: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [featured, setFeatured] = useState(initialFeatured);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  // Server data changed (after router.refresh()): start from it again.
  const [lastInitial, setLastInitial] = useState(initialFeatured);
  if (initialFeatured !== lastInitial) {
    setLastInitial(initialFeatured);
    setFeatured(initialFeatured);
  }

  async function reorder(next: FeaturedProduct[]) {
    const previous = featured;
    setFeatured(next);
    setBusy(true);
    const supabase = createClient();
    const results = await Promise.all(
      orderUpdates(next, (product) => product.featured_order).map(
        ({ id, order }) =>
          supabase
            .from("products")
            .update({ featured_order: order })
            .eq("id", id)
            .select("id"),
      ),
    );
    setBusy(false);
    if (results.some(({ error, data }) => error || !data?.length)) {
      setFeatured(previous);
      toast(ERROR, "error");
    } else {
      toast("Ordem salva.");
    }
    router.refresh();
  }

  async function setHighlight(product: FeaturedProduct, on: boolean) {
    setBusy(true);
    const order = on
      ? Math.max(-1, ...featured.map((item) => item.featured_order ?? -1)) + 1
      : null;
    const { data, error } = await createClient()
      .from("products")
      .update({ featured: on, featured_order: order })
      .eq("id", product.id)
      .select("id");
    setBusy(false);
    if (error || !data?.length) {
      toast(ERROR, "error");
      return;
    }
    setFeatured((items) =>
      on
        ? [...items, { ...product, featured_order: order }]
        : items.filter((item) => item.id !== product.id),
    );
    toast(
      on
        ? `“${product.name}” entrou nos destaques.`
        : `“${product.name}” saiu dos destaques.`,
    );
    router.refresh();
  }

  return (
    <>
      {featured.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-base text-muted-foreground">
          Nenhuma peça nos destaques. Toque em “Adicionar peça”.
        </p>
      ) : (
        <SortableList
          items={featured}
          getLabel={(product) => product.name}
          onReorder={reorder}
          disabled={busy}
          renderItem={(product, handle) => {
            // The store only lists published pieces, up to the limit.
            const position = featured
              .filter((item) => item.status === "published")
              .indexOf(product);
            const hidden = position >= storeLimit;
            return (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-2xl border border-border bg-card p-2",
                  hidden && "opacity-60",
                )}
              >
                {handle}
                <ProductThumb path={product.coverPath} size={56} />
                <span className="min-w-0 flex-1 px-1">
                  <span className="block truncate text-lg font-medium">
                    {product.name}
                  </span>
                  {product.status === "draft" ? (
                    <span className="block text-sm text-amber-700">
                      Rascunho: só aparece quando for publicado
                    </span>
                  ) : hidden ? (
                    <span className="block text-sm text-muted-foreground">
                      Depois da {storeLimit}ª: não aparece na loja
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  onClick={() => setHighlight(product, false)}
                  disabled={busy}
                  aria-label={`Tirar “${product.name}” dos destaques`}
                  className="grid size-12 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  <XIcon className="size-5" />
                </button>
              </div>
            );
          }}
        />
      )}

      <StickyActions>
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={busy}
          className={`${primaryButtonClassName} sm:ml-auto sm:w-auto sm:min-w-56`}
        >
          <PlusIcon className="size-5" />
          Adicionar peça
        </button>
      </StickyActions>

      {adding && (
        <AddDialog
          products={others.filter(
            (product) => !featured.some((item) => item.id === product.id),
          )}
          onClose={() => setAdding(false)}
          onPick={(product) => {
            setAdding(false);
            setHighlight(product, true);
          }}
        />
      )}
    </>
  );
}

function AddDialog({
  products,
  onClose,
  onPick,
}: {
  products: FeaturedProduct[];
  onClose: () => void;
  onPick: (product: FeaturedProduct) => void;
}) {
  const [search, setSearch] = useState("");
  const term = normalize(search.trim());
  const shown = term
    ? products.filter((product) => normalize(product.name).includes(term))
    : products;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 p-6 text-base sm:max-w-lg">
        <DialogHeader className="pr-10">
          <DialogTitle className="font-heading text-xl font-medium">
            Adicionar aos destaques
          </DialogTitle>
          <DialogDescription className="text-base">
            Toque na peça. Ela entra no fim da lista.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar pelo nome"
            aria-label="Buscar peça pelo nome"
            className={cn(inputClassName, "pl-12")}
          />
        </div>
        <ul className="-mx-2 min-h-0 flex-1 space-y-1 overflow-y-auto px-2">
          {shown.length === 0 && (
            <li className="py-6 text-center text-muted-foreground">
              {products.length === 0
                ? "Todas as peças já estão nos destaques."
                : "Nenhuma peça com esse nome."}
            </li>
          )}
          {shown.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => onPick(product)}
                className="flex min-h-16 w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted"
              >
                <ProductThumb path={product.coverPath} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {product.name}
                  </span>
                  {product.status === "draft" && (
                    <span className="block text-sm text-muted-foreground">
                      Rascunho
                    </span>
                  )}
                </span>
                <PlusIcon className="size-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
