import { BannerCarousel } from "@/components/store/banner-carousel";
import { CategoryTiles } from "@/components/store/category-tiles";
import { ProductGrid, ProductRow } from "@/components/store/product-card";
import { EmptyState, Section } from "@/components/store/section";
import { publicUrl } from "@/lib/storage";
import {
  getActiveBanners,
  getCategories,
  getFeaturedProducts,
  getRecentProducts,
} from "@/lib/store/queries";

export default async function HomePage() {
  const [banners, featured, categories, recent] = await Promise.all([
    getActiveBanners(),
    getFeaturedProducts(),
    getCategories(),
    getRecentProducts(),
  ]);

  const slides = banners.map((banner) => ({
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    href: banner.link_url,
    desktopSrc: publicUrl("images", banner.image_desktop_path),
    mobileSrc: publicUrl(
      "images",
      banner.image_mobile_path ?? banner.image_desktop_path,
    ),
  }));

  return (
    <div className="flex flex-col gap-16 pb-4">
      {slides.length > 0 ? (
        <>
          <h1 className="sr-only">DAN3D · Peças impressas em 3D</h1>
          <BannerCarousel slides={slides} />
        </>
      ) : (
        <Intro />
      )}

      {featured.length > 0 && (
        <Section eyebrow="Escolhidas para você" title="Destaques">
          <ProductRow products={featured} />
        </Section>
      )}

      {categories.length > 0 && (
        <Section eyebrow="Navegue por" title="Categorias">
          <CategoryTiles categories={categories} />
        </Section>
      )}

      <Section eyebrow="Acabaram de chegar" title="Novidades">
        {recent.length > 0 ? (
          <ProductGrid products={recent} />
        ) : (
          <EmptyState title="Novas peças em breve">
            Estamos preparando o catálogo. Volte daqui a pouquinho!
          </EmptyState>
        )}
      </Section>

      <HowItWorks />
    </div>
  );
}

/** Shown instead of the carousel when there is no active banner. */
function Intro() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10">
      <p className="font-heading text-xs tracking-[0.25em] text-muted-foreground uppercase">
        Impressão 3D sob encomenda
      </p>
      <h1 className="mt-3 max-w-xl font-heading text-4xl leading-tight tracking-wide text-balance sm:text-5xl">
        Veja a peça em tamanho real no seu espaço
      </h1>
      <p className="mt-4 max-w-lg text-lg text-pretty text-muted-foreground">
        Peças religiosas e infantis feitas com carinho. Aponte o celular e
        confira o tamanho antes de encomendar.
      </p>
    </section>
  );
}

const STEPS = [
  {
    title: "Escolha a peça",
    text: "Navegue pelas categorias e veja fotos e medidas.",
  },
  {
    title: "Veja no seu espaço",
    text: "Toque em “Ver no meu espaço” e a peça aparece em tamanho real pela câmera do celular.",
  },
  {
    title: "Encomende pelo WhatsApp",
    text: "A mensagem já vai pronta com a peça e as medidas.",
  },
];

function HowItWorks() {
  return (
    <Section eyebrow="Simples assim" title="Como funciona">
      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-2xl bg-card p-6 ring-1 ring-border"
          >
            <span className="font-heading text-3xl text-primary/40">
              {index + 1}
            </span>
            <h3 className="mt-2 font-medium">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
