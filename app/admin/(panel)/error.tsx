"use client";

import Link from "next/link";
import { useEffect } from "react";

import { primaryButtonClassName } from "@/components/admin/form";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);

  return (
    <div className="space-y-4 py-10 text-center">
      <h1 className="font-heading text-2xl font-medium">Esta tela não abriu</h1>
      <p className="text-base text-muted-foreground">
        Confira a internet e tente de novo. Se continuar, saia e entre de novo
        no painel.
      </p>
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className={`${primaryButtonClassName} sm:w-auto sm:min-w-56`}
        >
          Tentar de novo
        </button>
        <Link
          href="/admin"
          className="min-h-12 rounded-full px-4 py-3 text-base font-medium text-primary hover:underline"
        >
          Voltar ao início do painel
        </Link>
      </div>
    </div>
  );
}
