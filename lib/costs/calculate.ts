// Price of a 3D printed piece (PLAN.md §5, phase 6). Same steps as the old
// spreadsheet (docs/Calculadora_Custos_DAN3D.xlsx), with one change agreed
// with the owner: extras and packaging are passed on at cost, without margin.
// Money is in cents; intermediate values keep their fractions and only the
// outputs are rounded.

import type { MaterialCategory } from "@/types/database";

export interface CostSettings {
  filament_price_per_kg_cents: number;
  energy_price_per_kwh_cents: number;
  printer_power_w: number;
  machine_price_cents: number;
  machine_life_hours: number;
  maintenance_cents: number;
  failure_percent: number;
  labor_rate_per_hour_cents: number;
  margin_percent: number;
}

export interface Material {
  id: string;
  name: string;
  pack_units: number;
  pack_price_cents: number;
  category: MaterialCategory;
}

/** What is typed for each piece; stored as `product_costs.inputs`. */
export interface CostInputs {
  weightG: number;
  printHours: number;
  printMinutes: number;
  finishingMinutes: number;
  /** Price of the filament used in this piece; null = the default one. */
  filamentPricePerKgCents: number | null;
  materials: { materialId: string; quantity: number }[];
}

export interface CostBreakdown {
  printHours: number;
  filament: number;
  energy: number;
  depreciation: number;
  maintenance: number;
  printSubtotal: number;
  failures: number;
  finishing: number;
  /** Production cost the margin applies to. */
  base: number;
  profit: number;
  extras: number;
  packaging: number;
  /** base + profit + extras + packaging, before rounding. */
  price: number;
  /** Rounded up to end in ,90. */
  roundedPrice: number;
  /** Total cost: base + extras + packaging. */
  cost: number;
  /** What is left with the rounded price. */
  profitAtRoundedPrice: number;
}

/** Cost of `quantity` units of a material bought in packs. */
export function materialCost(material: Material, quantity: number): number {
  if (!(material.pack_units > 0) || !(quantity > 0)) return 0;
  return (material.pack_price_cents / material.pack_units) * quantity;
}

/**
 * Smallest price ending in ,90 that is not below `cents` (the spreadsheet's
 * CEILING(x + 0.1; 1) − 0.1). Zero stays zero.
 */
export function roundTo90(cents: number): number {
  const whole = Math.round(cents);
  if (whole <= 0) return 0;
  return Math.ceil((whole + 10) / 100) * 100 - 10;
}

const positive = (value: number) =>
  Number.isFinite(value) && value > 0 ? value : 0;

export function calculateCost(
  settings: CostSettings,
  inputs: CostInputs,
  materials: Material[],
): CostBreakdown {
  const printHours =
    positive(inputs.printHours) + positive(inputs.printMinutes) / 60;
  const filamentPrice =
    inputs.filamentPricePerKgCents ?? settings.filament_price_per_kg_cents;

  const filament = (positive(inputs.weightG) / 1000) * filamentPrice;
  const energy =
    printHours *
    (settings.printer_power_w / 1000) *
    settings.energy_price_per_kwh_cents;
  const life = settings.machine_life_hours;
  const depreciation =
    life > 0 ? (printHours * settings.machine_price_cents) / life : 0;
  const maintenance =
    life > 0 ? (printHours * settings.maintenance_cents) / life : 0;
  const printSubtotal = filament + energy + depreciation + maintenance;
  const failures = printSubtotal * (settings.failure_percent / 100);
  const finishing =
    (positive(inputs.finishingMinutes) / 60) *
    settings.labor_rate_per_hour_cents;
  const base = printSubtotal + failures + finishing;
  const profit = base * (settings.margin_percent / 100);

  let extras = 0;
  let packaging = 0;
  for (const { materialId, quantity } of inputs.materials) {
    const material = materials.find(({ id }) => id === materialId);
    if (!material) continue;
    const value = materialCost(material, quantity);
    if (material.category === "extra") extras += value;
    else packaging += value;
  }

  const price = base + profit + extras + packaging;
  const cost = base + extras + packaging;
  const roundedPrice = roundTo90(price);

  return {
    printHours,
    filament,
    energy,
    depreciation,
    maintenance,
    printSubtotal,
    failures,
    finishing,
    base,
    profit,
    extras,
    packaging,
    price,
    roundedPrice,
    cost,
    profitAtRoundedPrice: roundedPrice - cost,
  };
}

/** Starting values: materials marked "used by default" with their quantity. */
export function emptyCostInputs(
  materials: (Material & {
    default_quantity: number;
    used_by_default: boolean;
  })[],
): CostInputs {
  return {
    weightG: 0,
    printHours: 0,
    printMinutes: 0,
    finishingMinutes: 0,
    filamentPricePerKgCents: null,
    materials: materials
      .filter((material) => material.used_by_default)
      .map((material) => ({
        materialId: material.id,
        quantity: material.default_quantity,
      })),
  };
}

/**
 * Reads `product_costs.inputs` (jsonb) defensively: anything missing or of
 * the wrong type becomes a safe default instead of breaking the page.
 */
export function parseCostInputs(value: unknown): CostInputs | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const num = (key: string) => {
    const field = raw[key];
    return typeof field === "number" && Number.isFinite(field) && field >= 0
      ? field
      : 0;
  };
  const filament = raw.filamentPricePerKgCents;
  const materials = Array.isArray(raw.materials) ? raw.materials : [];
  return {
    weightG: num("weightG"),
    printHours: num("printHours"),
    printMinutes: num("printMinutes"),
    finishingMinutes: num("finishingMinutes"),
    filamentPricePerKgCents:
      typeof filament === "number" && Number.isFinite(filament) && filament >= 0
        ? filament
        : null,
    materials: materials.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const { materialId, quantity } = item as Record<string, unknown>;
      return typeof materialId === "string" &&
        typeof quantity === "number" &&
        quantity > 0
        ? [{ materialId, quantity }]
        : [];
    }),
  };
}
