import { BadgeCheckIcon, ChevronLeftIcon, RulerIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderButton } from "@/components/store/order-button";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductViewer } from "@/components/store/product-viewer";
import { ViewTracker } from "@/components/store/view-tracker";
import { dimensionList, formatCm, formatPrice } from "@/lib/format";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { publicUrl } from "@/lib/storage";
import { getProductBySlug, getSettings } from "@/lib/store/queries";
import {
  isValidWhatsAppNumber,
  orderMessage,
  whatsappLink,
} from "@/lib/whatsapp";

function describe(product: {
  name: string;
  description: string | null;
  height_mm: number | null;
}) {
  if (product.description) return product.description.slice(0, 160);
  const height = formatCm(product.height_mm);
  return `${product.name}${height ? `, ${height} de altura` : ""}, impressa em 3D. Veja em tamanho real no seu espaço antes de encomendar.`;
}

export async function generateMetadata({
  params,
}: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  const cover = product.product_images[0];
  const description = describe(product);
  return {
    title: product.name,
    description,
    alternates: { canonical: `/p/${product.slug}` },
    openGraph: {
      title: `${product.name} · ${SITE_NAME}`,
      description,
      url: `/p/${product.slug}`,
      ...(cover && {
        images: [
          {
            url: publicUrl("images", cover.path),
            alt: cover.alt ?? product.name,
          },
        ],
      }),
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([
    getProductBySlug(slug),
    getSettings(),
  ]);
  if (!product) notFound();

  const pageUrl = absoluteUrl(`/p/${product.slug}`);
  const images = product.product_images.map((image, index) => ({
    src: publicUrl("images", image.path),
    alt: image.alt ?? `${product.name}, foto ${index + 1}`,
  }));
  const dimensions = dimensionList(product);
  const orderHref = isValidWhatsAppNumber(settings?.whatsapp_number)
    ? whatsappLink(
        settings.whatsapp_number,
        orderMessage({ ...product, url: pageUrl }),
      )
    : null;
  const price = formatPrice(product.price_cents);

  return (
    <article className="mx-auto w-full max-w-6xl px-4 pt-4 pb-28 sm:pt-8 lg:pb-0">
      <ViewTracker productId={product.id} />

      {product.categories && (
        <nav aria-label="Você está em" className="mb-2 text-sm">
          <Link
            href={`/c/${product.categories.slug}`}
            className="inline-flex min-h-12 items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4" /> {product.categories.name}
          </Link>
        </nav>
      )}

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <ProductGallery images={images} productName={product.name} />
        </div>

        <div className="space-y-8 lg:pt-2">
          <header className="space-y-3">
            <h1 className="font-heading text-3xl leading-tight tracking-wide text-balance sm:text-4xl">
              {product.name}
            </h1>
            <p className="text-2xl font-medium text-primary">{price}</p>
            {product.made_to_order && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm">
                <BadgeCheckIcon className="size-4 text-primary" />
                Sob encomenda
              </p>
            )}
          </header>

          {dimensions.length > 0 && (
            <section aria-labelledby="medidas">
              <h2
                id="medidas"
                className="flex items-center gap-2 font-heading text-xs tracking-[0.2em] text-muted-foreground uppercase"
              >
                <RulerIcon className="size-4" /> Medidas da peça
              </h2>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                {dimensions.map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-2xl bg-card px-3 py-3 ring-1 ring-border"
                  >
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 text-lg font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <OrderButton
            href={orderHref}
            productId={product.id}
            className="hidden lg:flex"
          />

          {product.description && (
            <section aria-labelledby="sobre">
              <h2
                id="sobre"
                className="font-heading text-xs tracking-[0.2em] text-muted-foreground uppercase"
              >
                Sobre a peça
              </h2>
              <p className="mt-3 leading-relaxed text-pretty whitespace-pre-line">
                {product.description}
              </p>
            </section>
          )}

          {product.model_path && (
            <section aria-labelledby="em-3d" className="space-y-4">
              <h2 id="em-3d" className="font-heading text-2xl tracking-wide">
                Veja em 3D e no seu espaço
              </h2>
              <ProductViewer
                productId={product.id}
                name={product.name}
                modelSrc={publicUrl("models", product.model_path)}
                iosSrc={
                  product.model_usdz_path
                    ? publicUrl("models", product.model_usdz_path)
                    : undefined
                }
                posterSrc={
                  product.poster_path
                    ? publicUrl("images", product.poster_path)
                    : undefined
                }
                placement={product.ar_placement}
                pageUrl={pageUrl}
              />
            </section>
          )}
        </div>
      </div>

      {/* Main action pinned to the bottom on phones and tablets. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div className="shrink-0">
            <p className="text-xs text-muted-foreground">Valor</p>
            <p className="font-medium whitespace-nowrap text-primary">
              {price}
            </p>
          </div>
          <OrderButton href={orderHref} productId={product.id} />
        </div>
      </div>
    </article>
  );
}
