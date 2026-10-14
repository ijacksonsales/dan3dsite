"use client";

import { useEffect } from "react";

import "./globals.css";

/** Last resort when even the root layout fails: no header, no fonts. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);

  return (
    <html lang="pt-BR">
      <body className="grid min-h-svh place-items-center bg-background p-6 text-center text-foreground">
        <div className="max-w-md space-y-4">
          <h1 className="text-2xl font-medium">
            Não conseguimos abrir a loja agora
          </h1>
          <p className="text-muted-foreground">
            Tente de novo em alguns segundos.
          </p>
          <button
            type="button"
            onClick={reset}
            className="min-h-12 rounded-full bg-primary px-6 font-medium text-primary-foreground"
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
