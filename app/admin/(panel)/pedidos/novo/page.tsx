import type { Metadata } from "next";

import { OrderForm } from "@/components/admin/orders/order-form";
import { PageHeader } from "@/components/admin/page-header";
import { getOrderFormOptions } from "@/lib/orders/data";
import {
  parseQuoteItems,
  quoteItemDescription,
  quoteOrderNotes,
} from "@/lib/quotes/form";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pieces, deadline and notes of a site quote request ("Criar pedido"). */
async function getQuoteRequest(id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("quote_requests")
    .select("id, number, city, items, needed_by, notes, product_id, order_id")
    .eq("id", id)
    .maybeSingle();
  // Already turned into an order: start an empty one instead of a copy.
  return data && !data.order_id ? data : null;
}

export const metadata: Metadata = { title: "Novo pedido" };

export default async function NewOrderPage({
  searchParams,
}: PageProps<"/admin/pedidos/novo">) {
  const { cliente, item, orcamento } = await searchParams;
  const [options, quote] = await Promise.all([
    getOrderFormOptions(),
    getQuoteRequest(orcamento),
  ]);
  const customerId =
    typeof cliente === "string" &&
    options.customers.some(({ id }) => id === cliente)
      ? cliente
      : null;

  return (
    <>
      <PageHeader
        title="Novo pedido"
        backHref={
          quote
            ? `/admin/orcamentos/${quote.id}`
            : customerId
              ? `/admin/clientes/${customerId}`
              : "/admin/pedidos"
        }
        backLabel={
          quote ? "Pedido de orçamento" : customerId ? "Cliente" : "Pedidos"
        }
      >
        <p className="text-base text-muted-foreground">
          {quote
            ? `Peças do pedido de orçamento nº ${quote.number}. Calcule o preço de cada uma.`
            : "Começa como orçamento. Quando o cliente aprovar, é só confirmar."}
        </p>
      </PageHeader>
      <OrderForm
        options={options}
        fromCalculator={item === "calculadora"}
        quoteRequestId={quote?.id ?? null}
        initial={{
          id: null,
          customerId,
          dueDate: quote?.needed_by ?? null,
          discountCents: 0,
          shippingCents: 0,
          notes: quote ? quoteOrderNotes(quote) : null,
          items: quote
            ? parseQuoteItems(quote.items).map((piece) => ({
                product_id: null,
                description: quoteItemDescription(piece),
                quantity: piece.quantity,
                unit_price_cents: null,
                unit_cost_cents: null,
                unit_pass_through_cents: 0,
                cost_inputs: null,
              }))
            : [],
        }}
      />
    </>
  );
}
