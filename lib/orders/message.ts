import { formatDay } from "@/lib/dates";
import { formatPrice } from "@/lib/format";
import type { OrderStatus } from "@/types/database";

import { orderTotals, type TotalsInput } from "./totals";

export interface OrderMessageInput extends TotalsInput {
  number: number;
  status: OrderStatus;
  customerName: string;
  storeName: string;
  dueDate: string | null;
  items: (TotalsInput["items"][number] & { description: string })[];
}

const OPENING: Record<OrderStatus, string> = {
  quote: "segue o orçamento que combinamos:",
  confirmed: "seu pedido está confirmado:",
  in_production: "seu pedido já está sendo produzido:",
  ready: "seu pedido está pronto! 🎉",
  delivered: "obrigado pela compra! Segue o resumo do pedido:",
  canceled: "este pedido foi cancelado. Segue o resumo:",
};

/** Summary sent to the customer on WhatsApp (bold with *…*). */
export function orderMessage(order: OrderMessageInput): string {
  const totals = orderTotals(order);
  const firstName = order.customerName.trim().split(/\s+/)[0];
  const title = order.status === "quote" ? "Orçamento" : "Pedido";

  const lines = [
    `Olá, ${firstName}! Aqui é da ${order.storeName}, ${OPENING[order.status]}`,
    "",
    `*${title} nº ${order.number}*`,
    ...order.items.map(
      (item) =>
        `• ${item.quantity}× ${item.description.trim()}: ${formatPrice(item.quantity * item.unit_price_cents)}`,
    ),
  ];

  if (totals.discount || totals.shipping) {
    lines.push("", `Subtotal: ${formatPrice(totals.subtotal)}`);
    if (totals.discount)
      lines.push(`Desconto: −${formatPrice(totals.discount)}`);
    if (totals.shipping) lines.push(`Frete: ${formatPrice(totals.shipping)}`);
  } else {
    lines.push("");
  }
  lines.push(`*Total: ${formatPrice(totals.total)}*`);

  if (totals.paid > 0) {
    lines.push(`Já pago: ${formatPrice(totals.paid)}`);
    lines.push(
      totals.balance > 0
        ? `Falta pagar: ${formatPrice(totals.balance)}`
        : "Pagamento completo ✅",
    );
  }

  if (
    order.dueDate &&
    order.status !== "delivered" &&
    order.status !== "canceled"
  )
    lines.push("", `Previsão de entrega: ${formatDay(order.dueDate)}`);

  // Intl puts a non-breaking space after "R$"; WhatsApp shows it fine, but
  // plain spaces are safer when the text is copied elsewhere.
  return lines.join("\n").replace(/\u00a0/g, " ");
}
