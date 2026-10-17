import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { formatPrice } from "@/lib/format";
import { STATUS_LABEL, dueLabel, type DueTone } from "@/lib/orders/status";
import { orderTotals } from "@/lib/orders/totals";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";

/** Columns the order cards need (orders list, customer page). */
export const ORDER_CARD_COLUMNS =
  "id, number, status, due_date, discount_cents, shipping_cents, created_at, customers(name), order_items(quantity, unit_price_cents, unit_cost_cents), order_payments(amount_cents)";

export interface OrderCardData {
  id: string;
  number: number;
  status: OrderStatus;
  due_date: string | null;
  discount_cents: number;
  shipping_cents: number;
  customers: { name: string } | null;
  order_items: {
    quantity: number;
    unit_price_cents: number;
    unit_cost_cents: number | null;
  }[];
  order_payments: { amount_cents: number }[];
}

const STATUS_TONE: Record<OrderStatus, string> = {
  quote: "bg-secondary text-secondary-foreground",
  confirmed: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
  in_production:
    "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  ready:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
  delivered: "bg-muted text-muted-foreground",
  canceled: "bg-muted text-muted-foreground line-through",
};

export function StatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
        STATUS_TONE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const DUE_TONE: Record<DueTone, string> = {
  late: "text-destructive font-medium",
  soon: "text-amber-700 dark:text-amber-300 font-medium",
  normal: "text-muted-foreground",
};

export function DueText({
  status,
  dueDate,
  today,
}: {
  status: OrderStatus;
  dueDate: string | null;
  today: string;
}) {
  const due = dueLabel(status, dueDate, today);
  if (!due) return null;
  return <span className={DUE_TONE[due.tone]}>{due.text}</span>;
}

export function OrderCard({
  order,
  today,
  showCustomer = true,
}: {
  order: OrderCardData;
  today: string;
  showCustomer?: boolean;
}) {
  const totals = orderTotals({
    items: order.order_items,
    discount_cents: order.discount_cents,
    shipping_cents: order.shipping_cents,
    payments: order.order_payments,
  });
  const open = order.status !== "canceled" && order.status !== "delivered";

  return (
    <Link
      href={`/admin/pedidos/${order.id}`}
      className="flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-muted"
    >
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-lg font-medium">
            Nº {order.number}
            {showCustomer && order.customers
              ? ` · ${order.customers.name}`
              : ""}
          </span>
          <StatusBadge status={order.status} />
        </span>
        <span className="flex flex-wrap gap-x-3 text-base">
          <span>{formatPrice(totals.total)}</span>
          {open && totals.balance > 0 && totals.paid > 0 && (
            <span className="text-muted-foreground">
              falta {formatPrice(totals.balance)}
            </span>
          )}
          {open && totals.paid === 0 && totals.total > 0 && (
            <span className="text-muted-foreground">nada pago</span>
          )}
          <DueText
            status={order.status}
            dueDate={order.due_date}
            today={today}
          />
        </span>
      </span>
      <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
