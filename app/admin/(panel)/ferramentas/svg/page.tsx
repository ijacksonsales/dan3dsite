import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";

import { SvgTool } from "./svg-tool-loader";

export const metadata: Metadata = { title: "Imagem para SVG" };

export default function SvgToolPage() {
  return (
    <>
      <PageHeader title="Imagem para SVG">
        <p className="text-base text-muted-foreground">
          Transforma um desenho ou logo (PNG ou JPG) em SVG, o formato que o
          Bambu Studio usa para fazer relevo, chaveiros e placas. Funciona
          melhor com imagens de poucas cores e contornos nítidos.
        </p>
      </PageHeader>
      <SvgTool />
    </>
  );
}
