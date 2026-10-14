import Link from "next/link";

import {
  StatusMessage,
  statusPrimaryClassName,
  statusSecondaryClassName,
} from "./status-message";

export function NotFoundContent() {
  return (
    <StatusMessage
      eyebrow="Página não encontrada"
      title="Esta peça ou página não está mais aqui"
      actions={
        <>
          <Link href="/" className={statusPrimaryClassName}>
            Ver a loja
          </Link>
          <Link href="/busca" className={statusSecondaryClassName}>
            Buscar peças
          </Link>
        </>
      }
    >
      Ela pode ter mudado de endereço ou saído do catálogo. Veja as peças da
      loja ou busque pelo nome.
    </StatusMessage>
  );
}
