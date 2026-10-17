import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OrderForm } from "@/components/admin/orders/order-form";
import { PageHeader } from "@/components/admin/page-header";
import { parseCostInputs } from "@/lib/costs/calculate";
import { getOrderFormOptions } from "@/lib/orders/data";
import { isClosed } from "@/lib/orders/status";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Editar pedido" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditOrderPage({
  params,
}: PageProps<"/admin/pedidos/[id]/editar">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: order, error }, options] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "number, status, customer_id, due_date, discount_cents, shipping_cents, notes, order_items(product_id, description, quantity, unit_price_cents, unit_cost_cents, unit_pass_through_cents, cost_inputs, sort_order)",
      )
      .eq("id", id)
      .order("sort_order", { referencedTable: "order_items" })
      .maybeSingle(),
    getOrderFormOptions(),
  ]);
  if (error) throw error;
  if (!order) notFound();
  // Delivered or canceled orders are history: reopen them first.
  if (isClosed(order.status)) redirect(`/admin/pedidos/${id}`);

  return (
    <>
      <PageHeader
        title={`Editar pedido nº ${order.number}`}
        backHref={`/admin/pedidos/${id}`}
        backLabel={`Pedido nº ${order.number}`}
      />
      <OrderForm
        options={options}
        initial={{
          id,
          customerId: order.customer_id,
          dueDate: order.due_date,
          discountCents: order.discount_cents,
          shippingCents: order.shipping_cents,
          notes: order.notes,
          items: order.order_items.map((item) => ({
            ...item,
            cost_inputs: parseCostInputs(item.cost_inputs),
          })),
        }}
      />
    </>
  );
}
