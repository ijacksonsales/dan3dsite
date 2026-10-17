import type { Metadata } from "next";

import { OrderForm } from "@/components/admin/orders/order-form";
import { PageHeader } from "@/components/admin/page-header";
import { getOrderFormOptions } from "@/lib/orders/data";

export const metadata: Metadata = { title: "Novo pedido" };

export default async function NewOrderPage({
  searchParams,
}: PageProps<"/admin/pedidos/novo">) {
  const { cliente, item } = await searchParams;
  const options = await getOrderFormOptions();
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
          customerId ? `/admin/clientes/${customerId}` : "/admin/pedidos"
        }
        backLabel={customerId ? "Cliente" : "Pedidos"}
      >
        <p className="text-base text-muted-foreground">
          Começa como orçamento. Quando o cliente aprovar, é só confirmar.
        </p>
      </PageHeader>
      <OrderForm
        options={options}
        fromCalculator={item === "calculadora"}
        initial={{
          id: null,
          customerId,
          dueDate: null,
          discountCents: 0,
          shippingCents: 0,
          notes: null,
          items: [],
        }}
      />
    </>
  );
}
