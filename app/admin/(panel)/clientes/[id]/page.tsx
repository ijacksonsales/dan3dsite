import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ORDER_CARD_COLUMNS,
  OrderCard,
  type OrderCardData,
} from "@/components/admin/orders/order-card";
import { PageHeader } from "@/components/admin/page-header";
import { storeToday } from "@/lib/dates";
import { formatPrice } from "@/lib/format";
import { orderTotals } from "@/lib/orders/totals";
import { createClient } from "@/lib/supabase/server";

import { CustomerActions } from "./customer-actions";

export const metadata: Metadata = { title: "Cliente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomerPage({
  params,
}: PageProps<"/admin/clientes/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: customer, error }, orders] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone, notes")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select(ORDER_CARD_COLUMNS)
      .eq("customer_id", id)
      .order("number", { ascending: false }),
  ]);
  if (error) throw error;
  if (orders.error) throw orders.error;
  if (!customer) notFound();

  const list = orders.data as OrderCardData[];
  const spent = list
    .filter((order) => order.status === "delivered")
    .reduce(
      (sum, order) =>
        sum +
        orderTotals({
          items: order.order_items,
          discount_cents: order.discount_cents,
          shipping_cents: order.shipping_cents,
        }).total,
      0,
    );
  const today = storeToday();

  return (
    <>
      <PageHeader
        title={customer.name}
        backHref="/admin/clientes"
        backLabel="Clientes"
      />
      <CustomerActions customer={customer} orderCount={list.length} />

      <section className="mt-8 space-y-3">
        <h2 className="font-heading text-xl font-medium">Pedidos</h2>
        {list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-base text-muted-foreground">
            Nenhum pedido ainda.
          </p>
        ) : (
          <>
            {spent > 0 && (
              <p className="text-base text-muted-foreground">
                Já comprou {formatPrice(spent)} em pedidos entregues.
              </p>
            )}
            <ul className="space-y-3">
              {list.map((order) => (
                <li key={order.id}>
                  <OrderCard order={order} today={today} showCustomer={false} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
