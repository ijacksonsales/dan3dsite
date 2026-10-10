"use client";

import { SmartphoneIcon } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * On computers (no AR), a QR code that opens this page on the phone.
 * `qrcode` is loaded only there, so phones never download it.
 */
export function DesktopQr({ url }: { url: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;
    let active = true;
    import("qrcode")
      .then((QRCode) =>
        QRCode.toString(url, {
          type: "svg",
          margin: 0,
          errorCorrectionLevel: "M",
          color: { dark: "#20130a", light: "#00000000" },
        }),
      )
      .then((markup) => active && setSvg(markup))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [url]);

  if (!svg) return null;

  return (
    <div className="flex items-center gap-5 rounded-2xl bg-card p-5 ring-1 ring-border">
      <div
        className="size-28 shrink-0 [&_svg]:h-full [&_svg]:w-full"
        role="img"
        aria-label="QR code desta página"
        // SVG generated locally by `qrcode` from our own URL.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div>
        <p className="flex items-center gap-2 font-medium">
          <SmartphoneIcon className="size-4" /> Veja no seu espaço
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Aponte a câmera do celular para ver em tamanho real.
        </p>
      </div>
    </div>
  );
}
