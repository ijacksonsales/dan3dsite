"use client";

import { ImageIcon, LoaderCircleIcon, StarIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useToast } from "@/components/admin/toast";
import { formatPrice } from "@/lib/format";
import { publicUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProductStatus } from "@/types/database";

export interface AdminProductRow {
  id: string;
  name: string;
  status: ProductStatus;
  featured: boolean;
  price_cents: number | null;
  categoryName: string | null;
  coverPath: string | null;
}

export function ProductRow({ product }: { product: AdminProductRow }) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState(product.status);
  const [featured, setFeatured] = useState(product.featured);
  const [busy, setBusy] = useState<"status" | "featured" | null>(null);
  const published = status === "published";

  async function togglePublished() {
    const next: ProductStatus = published ? "draft" : "published";
    setBusy("status");
    setStatus(next);
    const { data, error } = await createClient()
      .from("products")
      .update({ status: next })
      .eq("id", product.id)
      .select("id");
    setBusy(null);
    if (error || !data?.length) {
      setStatus(status);
      toast(
        "Não foi possível mudar. Confira a internet e tente de novo.",
        "error",
      );
      return;
    }
    toast(
      next === "published"
        ? `“${product.name}” está na loja.`
        : `“${product.name}” saiu da loja (virou rascunho).`,
    );
    router.refresh();
  }

  async function toggleFeatured() {
    const next = !featured;
    setBusy("featured");
    setFeatured(next);
    const supabase = createClient();
    let featuredOrder: number | null = null;
    if (next) {
      // New highlights go to the end of the list.
      const { data: last } = await supabase
        .from("products")
        .select("featured_order")
        .eq("featured", true)
        .order("featured_order", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      featuredOrder = (last?.featured_order ?? -1) + 1;
    }
    const { data, error } = await supabase
      .from("products")
      .update({ featured: next, featured_order: featuredOrder })
      .eq("id", product.id)
      .select("id");
    setBusy(null);
    if (error || !data?.length) {
      setFeatured(featured);
      toast(
        "Não foi possível mudar. Confira a internet e tente de novo.",
        "error",
      );
      return;
    }
    toast(
      next
        ? published
          ? `“${product.name}” está nos destaques.`
          : `“${product.name}” vai para os destaques quando for publicado.`
        : `“${product.name}” saiu dos destaques.`,
    );
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3 rounded-2xl border border-border bg-card p-2 sm:flex-nowrap">
      <Link
        href={`/admin/produtos/${product.id}`}
        className="flex min-h-16 min-w-0 flex-1 basis-full items-center gap-3 rounded-xl p-1 hover:bg-muted sm:basis-auto"
      >
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-muted-foreground">
          {product.coverPath ? (
            <Image
              src={publicUrl("images", product.coverPath)}
              alt=""
              width={64}
              height={64}
              className="size-full object-cover"
            />
          ) : (
            <ImageIcon className="size-6" aria-label="Sem foto" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-medium">
            {product.name}
          </span>
          <span className="block truncate text-base text-muted-foreground">
            {[
              product.categoryName ?? "Sem categoria",
              formatPrice(product.price_cents),
            ].join(" · ")}
          </span>
        </span>
      </Link>

      <div className="flex w-full items-center gap-2 sm:w-auto">
        <button
          type="button"
          onClick={toggleFeatured}
          disabled={busy !== null}
          aria-pressed={featured}
          aria-label={
            featured ? "Tirar dos destaques" : "Colocar nos destaques"
          }
          title={featured ? "Nos destaques" : "Fora dos destaques"}
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full border transition-colors disabled:opacity-60",
            featured
              ? "border-amber-300 bg-amber-50 text-amber-600"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {busy === "featured" ? (
            <LoaderCircleIcon className="size-5 animate-spin" />
          ) : (
            <StarIcon className={cn("size-5", featured && "fill-current")} />
          )}
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={published}
          onClick={togglePublished}
          disabled={busy !== null}
          className="inline-flex min-h-12 flex-1 items-center justify-between gap-3 rounded-full border border-border px-4 text-base font-medium hover:bg-muted disabled:opacity-60 sm:w-44 sm:flex-none"
        >
          <span>{published ? "Na loja" : "Rascunho"}</span>
          <span
            aria-hidden
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition-colors",
              published ? "bg-emerald-600" : "bg-input",
            )}
          >
            <span
              className={cn(
                "absolute top-1 left-1 grid size-5 place-items-center rounded-full bg-white shadow transition-transform",
                published && "translate-x-5",
              )}
            >
              {busy === "status" && (
                <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" />
              )}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
