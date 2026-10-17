import { daysBetween, formatShortDay } from "@/lib/dates";
import type { OrderStatus, PaymentMethod } from "@/types/database";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  quote: "Orçamento",
  confirmed: "Confirmado",
  in_production: "Em produção",
  ready: "Pronto",
  delivered: "Entregue",
  canceled: "Cancelado",
};

/** Normal path of an order, in order. */
export const STATUS_FLOW: OrderStatus[] = [
  "quote",
  "confirmed",
  "in_production",
  "ready",
  "delivered",
];

const NEXT_ACTION: Partial<Record<OrderStatus, string>> = {
  quote: "Cliente aprovou",
  confirmed: "Começar produção",
  in_production: "Marcar como pronto",
  ready: "Marcar como entregue",
};

/** The one big button on the order page: where the order goes next. */
export function nextStep(
  status: OrderStatus,
): { status: OrderStatus; label: string } | null {
  const index = STATUS_FLOW.indexOf(status);
  const label = NEXT_ACTION[status];
  if (index < 0 || !label) return null;
  return { status: STATUS_FLOW[index + 1], label };
}

/** Delivered and canceled orders are closed: no more edits to items. */
export function isClosed(status: OrderStatus): boolean {
  return status === "delivered" || status === "canceled";
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  card: "Cartão",
  other: "Outro",
};

export type OrderTab = "andamento" | "orcamentos" | "entregues" | "cancelados";

export const ORDER_TABS: {
  tab: OrderTab;
  label: string;
  statuses: OrderStatus[];
}[] = [
  {
    tab: "andamento",
    label: "Em andamento",
    statuses: ["confirmed", "in_production", "ready"],
  },
  { tab: "orcamentos", label: "Orçamentos", statuses: ["quote"] },
  { tab: "entregues", label: "Entregues", statuses: ["delivered"] },
  { tab: "cancelados", label: "Cancelados", statuses: ["canceled"] },
];

export function parseOrderTab(value: unknown): OrderTab {
  return ORDER_TABS.some(({ tab }) => tab === value)
    ? (value as OrderTab)
    : "andamento";
}

export type DueTone = "late" | "soon" | "normal";

/**
 * Deadline text for open orders: "Atrasado 2 dias", "Entrega hoje",
 * "Entrega amanhã", "Entrega em 3 dias", "Entrega 28/10". Closed orders and
 * orders without a date get null.
 */
export function dueLabel(
  status: OrderStatus,
  dueDate: string | null,
  today: string,
): { text: string; tone: DueTone } | null {
  if (!dueDate || isClosed(status)) return null;
  const days = daysBetween(today, dueDate);
  if (days < 0)
    return {
      text: `Atrasado ${-days === 1 ? "1 dia" : `${-days} dias`}`,
      tone: "late",
    };
  if (days === 0) return { text: "Entrega hoje", tone: "soon" };
  if (days === 1) return { text: "Entrega amanhã", tone: "soon" };
  if (days <= 3) return { text: `Entrega em ${days} dias`, tone: "soon" };
  return { text: `Entrega ${formatShortDay(dueDate)}`, tone: "normal" };
}
