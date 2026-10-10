import Link from "next/link";

import { getCategories, getSettings } from "@/lib/store/queries";
import { isValidWhatsAppNumber, whatsappLink } from "@/lib/whatsapp";

import { BrandLogo } from "./brand-logo";
import { InstagramIcon, WhatsAppIcon } from "./icons";

export async function StoreFooter() {
  const [settings, categories] = await Promise.all([
    getSettings(),
    getCategories(),
  ]);
  const whatsapp = isValidWhatsAppNumber(settings?.whatsapp_number)
    ? whatsappLink(
        settings.whatsapp_number,
        "Olá! Vim pelo site da DAN3D e gostaria de saber mais sobre as peças.",
      )
    : null;

  return (
    <footer className="mt-20 bg-espresso text-sand">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <BrandLogo tone="light" />
          <p className="max-w-sm text-sm leading-relaxed text-sand/75">
            {settings?.about_text ??
              "Peças impressas em 3D com carinho, sob encomenda. Veja cada uma em tamanho real no seu espaço antes de pedir."}
          </p>
        </div>

        {categories.length > 0 && (
          <nav aria-label="Categorias no rodapé">
            <h2 className="font-heading text-xs tracking-[0.2em] text-sand/60 uppercase">
              Categorias
            </h2>
            <ul className="mt-2">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/c/${c.slug}`}
                    className="flex min-h-12 items-center text-sand/90 hover:text-sand"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div>
          <h2 className="font-heading text-xs tracking-[0.2em] text-sand/60 uppercase">
            Fale com a gente
          </h2>
          <ul className="mt-2">
            {whatsapp && (
              <li>
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center gap-3 text-sand/90 hover:text-sand"
                >
                  <WhatsAppIcon className="size-5" />
                  WhatsApp
                </a>
              </li>
            )}
            {settings?.instagram_url && (
              <li>
                <a
                  href={settings.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center gap-3 text-sand/90 hover:text-sand"
                >
                  <InstagramIcon className="size-5" />
                  Instagram
                </a>
              </li>
            )}
            {!whatsapp && !settings?.instagram_url && (
              <li className="text-sm text-sand/60">Contatos em breve.</li>
            )}
          </ul>
        </div>
      </div>
      <p className="border-t border-sand/10 px-4 py-6 text-center text-xs text-sand/75">
        © {new Date().getFullYear()} {settings?.store_name ?? "DAN3D"} · Peças
        impressas em 3D
      </p>
    </footer>
  );
}
