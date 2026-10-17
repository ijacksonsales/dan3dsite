import "server-only";

import { parseCostInputs, type CostInputs } from "@/lib/costs/calculate";
import { getCostData } from "@/lib/costs/data";
import { createClient } from "@/lib/supabase/server";

/** Everything the order form offers: customers, catalog and calculator. */
export async function getOrderFormOptions() {
  const supabase = await createClient();
  const [costData, customers, products, savedCosts] = await Promise.all([
    getCostData(),
    supabase.from("customers").select("id, name, phone, notes").order("name"),
    supabase.from("products").select("id, name, price_cents").order("name"),
    supabase.from("product_costs").select("product_id, inputs"),
  ]);
  if (customers.error) throw customers.error;
  if (products.error) throw products.error;
  if (savedCosts.error) throw savedCosts.error;

  const costs: Record<string, CostInputs> = {};
  for (const { product_id, inputs } of savedCosts.data) {
    const parsed = parseCostInputs(inputs);
    if (parsed) costs[product_id] = parsed;
  }

  return {
    ...costData,
    customers: customers.data,
    products: products.data,
    savedCosts: costs,
  };
}

export type OrderFormOptions = Awaited<ReturnType<typeof getOrderFormOptions>>;
