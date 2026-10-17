import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { getCostData } from "@/lib/costs/data";

import { CostSettingsForm } from "./cost-settings-form";
import { MaterialManager } from "./material-manager";

export const metadata: Metadata = { title: "Valores da calculadora" };

export default async function CostSettingsPage() {
  const { settings, materials } = await getCostData();

  return (
    <>
      <PageHeader
        title="Valores da calculadora"
        backHref="/admin/calculadora"
        backLabel="Calculadora"
      >
        <p className="text-base text-muted-foreground">
          Valem para todos os cálculos novos. Pedidos já feitos não mudam.
        </p>
      </PageHeader>
      <CostSettingsForm initial={settings} />
      <MaterialManager initial={materials} />
    </>
  );
}
