import type { Metadata } from "next";

import { QuoteForm } from "@/components/store/quote-form";
import { storeToday } from "@/lib/dates";
import { getProductBySlug, getSettings } from "@/lib/store/queries";
import { isValidWhatsAppNumber } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Orçamento personalizado",
  description:
    "Conte qual peça você quer, o tamanho e mande fotos de referência. A gente responde pelo WhatsApp.",
  alternates: { canonical: "/orcamento" },
};

export default async function QuotePage({
  searchParams,
}: PageProps<"/orcamento">) {
  const { peca } = await searchParams;
  const slug = typeof peca === "string" ? peca.slice(0, 120) : null;
  const [settings, product] = await Promise.all([
    getSettings(),
    slug ? getProductBySlug(slug) : null,
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 pb-32">
      <p className="font-heading text-xs tracking-[0.25em] text-muted-foreground uppercase">
        Feito sob medida
      </p>
      <h1 className="mt-2 font-heading text-3xl leading-tight tracking-wide text-balance sm:text-4xl">
        Orçamento personalizado
      </h1>
      <p className="mt-3 text-lg text-pretty text-muted-foreground">
        Conte qual peça você quer, o tamanho e, se tiver, mande fotos de
        referência. A gente responde pelo WhatsApp com o valor e o prazo.
      </p>

      <QuoteForm
        today={storeToday()}
        storeWhatsApp={
          isValidWhatsAppNumber(settings?.whatsapp_number)
            ? settings.whatsapp_number
            : null
        }
        reference={product ? { id: product.id, name: product.name } : null}
      />
    </div>
  );
}
