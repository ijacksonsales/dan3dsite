import { SlidersHorizontalIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { parseCostInputs, type CostInputs } from "@/lib/costs/calculate";
import { getCostData } from "@/lib/costs/data";
import { createClient } from "@/lib/supabase/server";

import { Calculator } from "./calculator";

export const metadata: Metadata = { title: "Calculadora de preço" };

export default async function CalculatorPage({
  searchParams,
}: PageProps<"/admin/calculadora">) {
  const { produto } = await searchParams;
  const supabase = await createClient();
  const [{ settings, materials }, products, savedCosts] = await Promise.all([
    getCostData(),
    supabase.from("products").select("id, name, price_cents").order("name"),
    supabase.from("product_costs").select("product_id, inputs"),
  ]);
  if (products.error) throw products.error;
  if (savedCosts.error) throw savedCosts.error;

  const saved: Record<string, CostInputs> = {};
  for (const { product_id, inputs } of savedCosts.data) {
    const parsed = parseCostInputs(inputs);
    if (parsed) saved[product_id] = parsed;
  }

  const productId =
    typeof produto === "string" &&
    products.data.some((product) => product.id === produto)
      ? produto
      : null;

  return (
    <>
      <PageHeader
        title="Calculadora de preço"
        {...(productId && {
          backHref: `/admin/produtos/${productId}`,
          backLabel: "Produto",
        })}
      >
        <Link
          href="/admin/calculadora/ajustes"
          className="-ml-1 inline-flex min-h-12 items-center gap-2 rounded-full px-1 text-base font-medium text-primary underline-offset-4 hover:underline"
        >
          <SlidersHorizontalIcon className="size-5" />
          Valores da máquina, margem e materiais
        </Link>
      </PageHeader>
      <Calculator
        settings={settings}
        materials={materials}
        products={products.data}
        savedCosts={saved}
        initialProductId={productId}
      />
    </>
  );
}
