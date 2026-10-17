import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/orders/order-card";
import { storeToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

import { OrderDetail } from "./order-detail";

export const metadata: Metadata = { title: "Pedido" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderPage({
  params,
}: PageProps<"/admin/pedidos/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: order, error }, { data: settings }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, number, status, due_date, discount_cents, shipping_cents, notes, created_at, customers(id, name, phone), order_items(id, product_id, description, quantity, unit_price_cents, unit_cost_cents, sort_order), order_payments(id, amount_cents, paid_on, method, note)",
      )
      .eq("id", id)
      .order("sort_order", { referencedTable: "order_items" })
      .order("paid_on", { referencedTable: "order_payments" })
      .maybeSingle(),
    supabase.from("settings").select("store_name").eq("id", 1).maybeSingle(),
  ]);
  if (error) throw error;
  if (!order || !order.customers) notFound();

  return (
    <>
      <PageHeader
        title={`${order.status === "quote" ? "Orçamento" : "Pedido"} nº ${order.number}`}
        backHref="/admin/pedidos"
        backLabel="Pedidos"
      >
        <StatusBadge status={order.status} />
      </PageHeader>
      <OrderDetail
        key={`${order.status}-${order.order_payments.length}`}
        order={{ ...order, customer: order.customers }}
        storeName={settings?.store_name ?? "DAN3D"}
        today={storeToday()}
      />
    </>
  );
}
