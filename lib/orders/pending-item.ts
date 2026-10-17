import { parseCostInputs, type CostInputs } from "@/lib/costs/calculate";

// Hands a calculation from the calculator page to a new order ("Usar num
// pedido"). Kept in sessionStorage: it only needs to survive one navigation
// in this tab, and a missing value just means an empty order form.

const KEY = "dan3d:pending-order-item";

export interface PendingOrderItem {
  productId: string | null;
  description: string;
  inputs: CostInputs;
}

export function savePendingItem(item: PendingOrderItem) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(item));
  } catch {}
}

/** Reads and clears it, so a reload does not add the item twice. */
export function takePendingItem(): PendingOrderItem | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Record<string, unknown>;
    const inputs = parseCostInputs(value.inputs);
    if (!inputs) return null;
    return {
      productId: typeof value.productId === "string" ? value.productId : null,
      description:
        typeof value.description === "string" ? value.description : "",
      inputs,
    };
  } catch {
    return null;
  }
}
