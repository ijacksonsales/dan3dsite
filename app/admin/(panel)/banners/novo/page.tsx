import type { Metadata } from "next";

import { BannerForm } from "@/components/admin/banner-form";
import { PageHeader } from "@/components/admin/page-header";
import { bannerFormOptions } from "@/lib/admin/banner-page-data";

export const metadata: Metadata = { title: "Novo banner" };

export default async function NewBannerPage() {
  const options = await bannerFormOptions();
  return (
    <>
      <PageHeader
        title="Novo banner"
        backHref="/admin/banners"
        backLabel="Banners"
      />
      <BannerForm
        // Images are uploaded under the banner id before the row exists.
        bannerId={crypto.randomUUID()}
        isNew
        initial={{
          title: null,
          subtitle: null,
          image_desktop_path: null,
          image_mobile_path: null,
          link_url: null,
          starts_at: null,
          ends_at: null,
          active: true,
        }}
        {...options}
      />
    </>
  );
}
