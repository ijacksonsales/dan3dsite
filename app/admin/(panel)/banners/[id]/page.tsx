import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BannerForm } from "@/components/admin/banner-form";
import { PageHeader } from "@/components/admin/page-header";
import { bannerFormOptions } from "@/lib/admin/banner-page-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Editar banner" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditBannerPage({
  params,
}: PageProps<"/admin/banners/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: banner, error }, options] = await Promise.all([
    supabase
      .from("banners")
      .select(
        "title, subtitle, image_desktop_path, image_mobile_path, link_url, starts_at, ends_at, active",
      )
      .eq("id", id)
      .maybeSingle(),
    bannerFormOptions(),
  ]);
  if (error) throw error;
  if (!banner) notFound();

  return (
    <>
      <PageHeader
        title={banner.title ?? "Banner sem título"}
        backHref="/admin/banners"
        backLabel="Banners"
      />
      <BannerForm bannerId={id} isNew={false} initial={banner} {...options} />
    </>
  );
}
