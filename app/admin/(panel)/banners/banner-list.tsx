"use client";

import { ChevronRightIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StickyActions, primaryButtonClassName } from "@/components/admin/form";
import { SortableList } from "@/components/admin/sortable-list";
import { useToast } from "@/components/admin/toast";
import { bannerState, bannerStateLabel } from "@/lib/admin/banners";
import { orderUpdates } from "@/lib/admin/reorder";
import { publicUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface BannerRow {
  id: string;
  title: string | null;
  image_desktop_path: string;
  image_mobile_path: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
}

export function BannerList({ initial }: { initial: BannerRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [banners, setBanners] = useState(initial);
  const [saving, setSaving] = useState(false);

  // Server data changed (after router.refresh()): start from it again.
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setBanners(initial);
  }

  async function reorder(next: BannerRow[]) {
    const previous = banners;
    setBanners(next);
    setSaving(true);
    const supabase = createClient();
    const results = await Promise.all(
      orderUpdates(next, (banner) => banner.sort_order).map(({ id, order }) =>
        supabase
          .from("banners")
          .update({ sort_order: order })
          .eq("id", id)
          .select("id"),
      ),
    );
    setSaving(false);
    if (results.some(({ error, data }) => error || !data?.length)) {
      setBanners(previous);
      toast(
        "Não foi possível salvar a nova ordem. Confira a internet e tente de novo.",
        "error",
      );
    } else {
      toast("Ordem salva.");
    }
    router.refresh();
  }

  return (
    <>
      {banners.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-base text-muted-foreground">
          Nenhum banner ainda. Toque em “Novo banner”.
        </p>
      ) : (
        <SortableList
          items={banners}
          getLabel={(banner) => banner.title ?? "Banner sem título"}
          onReorder={reorder}
          disabled={saving}
          renderItem={(banner, handle) => {
            const live = bannerState(banner) === "live";
            return (
              <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-2">
                {handle}
                <Link
                  href={`/admin/banners/${banner.id}`}
                  className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl p-1 hover:bg-muted"
                >
                  <Image
                    src={publicUrl(
                      "images",
                      banner.image_mobile_path ?? banner.image_desktop_path,
                    )}
                    alt=""
                    width={48}
                    height={60}
                    className={cn(
                      "h-15 w-12 shrink-0 rounded-lg object-cover",
                      !live && "opacity-50 grayscale",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-medium">
                      {banner.title ?? "Sem título"}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-2 text-base",
                        live ? "text-emerald-700" : "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          live ? "bg-emerald-600" : "bg-muted-foreground/50",
                        )}
                      />
                      {bannerStateLabel(banner)}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
                </Link>
              </div>
            );
          }}
        />
      )}

      <StickyActions>
        <Link
          href="/admin/banners/novo"
          className={`${primaryButtonClassName} sm:ml-auto sm:w-auto sm:min-w-56`}
        >
          <PlusIcon className="size-5" />
          Novo banner
        </Link>
      </StickyActions>
    </>
  );
}
