import { PlusIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StickyActions, primaryButtonClassName } from "@/components/admin/form";
import {
  ORDER_CARD_COLUMNS,
  OrderCard,
  type OrderCardData,
} from "@/components/admin/orders/order-card";
import { PageHeader } from "@/components/admin/page-header";
import { storeToday } from "@/lib/dates";
import { ORDER_TABS, parseOrderTab } from "@/lib/orders/status";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pedidos" };

/** Closed tabs show the most recent ones only. */
const CLOSED_LIMIT = 100;

export default async function OrdersPage({
  searchParams,
}: PageProps<"/admin/pedidos">) {
  const { aba } = await searchParams;
  const tab = parseOrderTab(aba);
  const { statuses } = ORDER_TABS.find((item) => item.tab === tab)!;
  const open = tab === "andamento" || tab === "orcamentos";

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(ORDER_CARD_COLUMNS)
    .in("status", statuses);
  query = open
    ? query
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("number", { ascending: true })
    : query.order("number", { ascending: false }).limit(CLOSED_LIMIT);
  const { data, error } = await query;
  if (error) throw error;
  const orders = data as OrderCardData[];
  const today = storeToday();

  return (
    <>
      <PageHeader title="Pedidos">
        <Link
          href="/admin/clientes"
          className="-ml-1 inline-flex min-h-12 items-center gap-2 rounded-full px-1 text-base font-medium text-primary underline-offset-4 hover:underline"
        >
          <UsersIcon className="size-5" />
          Clientes
        </Link>
      </PageHeader>

      <nav
        aria-label="Situação dos pedidos"
        className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {ORDER_TABS.map((item) => (
          <Link
            key={item.tab}
            href={
              item.tab === "andamento"
                ? "/admin/pedidos"
                : `/admin/pedidos?aba=${item.tab}`
            }
            aria-current={item.tab === tab ? "page" : undefined}
            className={cn(
              "inline-flex min-h-12 shrink-0 items-center rounded-full border px-5 text-base font-medium",
              item.tab === tab
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-base text-muted-foreground">
          {tab === "andamento"
            ? "Nenhum pedido em andamento. Quando um orçamento for aprovado, ele aparece aqui."
            : tab === "orcamentos"
              ? "Nenhum orçamento aberto."
              : tab === "entregues"
                ? "Nenhum pedido entregue ainda."
                : "Nenhum pedido cancelado."}
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} today={today} />
            </li>
          ))}
        </ul>
      )}
      {!open && orders.length === CLOSED_LIMIT && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Mostrando os {CLOSED_LIMIT} mais recentes.
        </p>
      )}

      <StickyActions>
        <Link
          href="/admin/pedidos/novo"
          className={`${primaryButtonClassName} sm:ml-auto sm:w-auto sm:min-w-56`}
        >
          <PlusIcon className="size-5" />
          Novo pedido
        </Link>
      </StickyActions>
    </>
  );
}
