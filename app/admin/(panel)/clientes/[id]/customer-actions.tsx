"use client";

import { MessageCircleIcon, PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { StickyActions, primaryButtonClassName } from "@/components/admin/form";
import {
  CustomerDialog,
  type CustomerValues,
} from "@/components/admin/orders/customer-dialog";
import { useToast } from "@/components/admin/toast";
import { formatWhatsApp } from "@/lib/admin/settings";

export function CustomerActions({
  customer,
  orderCount,
}: {
  customer: CustomerValues;
  orderCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-lg">
          {customer.phone
            ? formatWhatsApp(customer.phone)
            : "Sem WhatsApp cadastrado"}
        </p>
        {customer.notes && (
          <p className="text-base whitespace-pre-line text-muted-foreground">
            {customer.notes}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-input bg-card px-5 font-medium hover:bg-muted"
          >
            <PencilIcon className="size-5" />
            Editar
          </button>
          {customer.phone && (
            <a
              href={`https://wa.me/${customer.phone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-input bg-card px-5 font-medium hover:bg-muted"
            >
              <MessageCircleIcon className="size-5" />
              Abrir conversa
            </a>
          )}
        </div>
      </div>

      <StickyActions>
        <Link
          href={`/admin/pedidos/novo?cliente=${customer.id}`}
          className={`${primaryButtonClassName} sm:ml-auto sm:w-auto sm:min-w-56`}
        >
          <PlusIcon className="size-5" />
          Novo pedido para {customer.name.split(/\s+/)[0]}
        </Link>
      </StickyActions>

      {editing && (
        <CustomerDialog
          customer={customer}
          canDelete={orderCount === 0}
          onClose={() => setEditing(false)}
          onSaved={(_, message) => {
            setEditing(false);
            toast(message);
            router.refresh();
          }}
          onDeleted={() => {
            toast("Cliente excluído.");
            router.push("/admin/clientes");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
