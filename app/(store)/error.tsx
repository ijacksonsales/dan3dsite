"use client";

import Link from "next/link";
import { useEffect } from "react";

import {
  StatusMessage,
  statusPrimaryClassName,
  statusSecondaryClassName,
} from "@/components/store/status-message";

export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);

  return (
    <StatusMessage
      eyebrow="Algo deu errado"
      title="Não conseguimos abrir esta página agora"
      actions={
        <>
          <button
            type="button"
            onClick={reset}
            className={statusPrimaryClassName}
          >
            Tentar de novo
          </button>
          <Link href="/" className={statusSecondaryClassName}>
            Ver a loja
          </Link>
        </>
      }
    >
      Pode ser a conexão ou uma falha rápida do nosso lado. Tente de novo em
      alguns segundos.
    </StatusMessage>
  );
}
