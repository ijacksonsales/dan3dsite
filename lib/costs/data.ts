import "server-only";

import { createClient } from "@/lib/supabase/server";

export const COST_SETTINGS_COLUMNS =
  "filament_price_per_kg_cents, energy_price_per_kwh_cents, printer_power_w, machine_price_cents, machine_life_hours, maintenance_cents, failure_percent, labor_rate_per_hour_cents, margin_percent";

export const MATERIAL_COLUMNS =
  "id, name, pack_units, pack_price_cents, category, default_quantity, used_by_default, sort_order";

/** Calculator parameters and materials (admin-only tables). */
export async function getCostData() {
  const supabase = await createClient();
  const [settings, materials] = await Promise.all([
    supabase
      .from("cost_settings")
      .select(COST_SETTINGS_COLUMNS)
      .eq("id", 1)
      .single(),
    supabase
      .from("materials")
      .select(MATERIAL_COLUMNS)
      .order("sort_order")
      .order("name"),
  ]);
  if (settings.error) throw settings.error;
  if (materials.error) throw materials.error;
  return { settings: settings.data, materials: materials.data };
}

export type CostData = Awaited<ReturnType<typeof getCostData>>;
export type AdminMaterial = CostData["materials"][number];
