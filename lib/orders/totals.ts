export interface TotalsItem {
  quantity: number;
  unit_price_cents: number;
  /** null = cost not calculated for this item. */
  unit_cost_cents: number | null;
}

export interface TotalsInput {
  items: TotalsItem[];
  discount_cents: number;
  shipping_cents: number;
  payments?: { amount_cents: number }[];
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  /** What the customer pays: subtotal − discount + shipping. */
  total: number;
  /** Sum of the known item costs. */
  cost: number;
  /** False when at least one item has no calculated cost. */
  costKnown: boolean;
  /**
   * Estimated profit: subtotal − discount − cost. Shipping is left out: it
   * goes to the carrier.
   */
  profit: number;
  paid: number;
  /** Still to receive (never negative). */
  balance: number;
}

export function orderTotals({
  items,
  discount_cents,
  shipping_cents,
  payments = [],
}: TotalsInput): OrderTotals {
  let subtotal = 0;
  let cost = 0;
  let costKnown = true;
  for (const item of items) {
    subtotal += item.quantity * item.unit_price_cents;
    if (item.unit_cost_cents == null) costKnown = false;
    else cost += item.quantity * item.unit_cost_cents;
  }
  const discount = Math.min(discount_cents, subtotal);
  const total = subtotal - discount + shipping_cents;
  const paid = payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
  return {
    subtotal,
    discount,
    shipping: shipping_cents,
    total,
    cost,
    costKnown,
    profit: subtotal - discount - cost,
    paid,
    balance: Math.max(0, total - paid),
  };
}
