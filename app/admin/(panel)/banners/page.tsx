import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { createClient } from "@/lib/supabase/server";

import { BannerList } from "./banner-list";

export const metadata: Metadata = { title: "Banners" };

export default async function BannersPage() {
  const supabase = await createClient();
  const { data: banners, error } = await supabase
    .from("banners")
    .select(
      "id, title, image_desktop_path, image_mobile_path, active, starts_at, ends_at, sort_order",
    )
    .order("sort_order");
  if (error) throw error;

  return (
    <>
      <PageHeader title="Banners">
        <p className="text-base text-muted-foreground">
          Imagens grandes do topo da página inicial, nesta ordem. Arraste pelo{" "}
          <span aria-hidden>⋮⋮</span> para mudar.
        </p>
      </PageHeader>
      <BannerList initial={banners} />
    </>
  );
}
