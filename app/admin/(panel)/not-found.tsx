import Link from "next/link";

import { primaryButtonClassName } from "@/components/admin/form";

export default function AdminNotFound() {
  return (
    <div className="space-y-4 py-10 text-center">
      <h1 className="font-heading text-2xl font-medium">
        Não encontramos isso
      </h1>
      <p className="text-base text-muted-foreground">
        Pode ter sido excluído, ou o endereço está incompleto.
      </p>
      <Link
        href="/admin"
        className={`${primaryButtonClassName} sm:w-auto sm:min-w-56`}
      >
        Voltar ao início do painel
      </Link>
    </div>
  );
}
