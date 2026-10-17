import { describe, expect, it } from "vitest";

import {
  calculateCost,
  emptyCostInputs,
  parseCostInputs,
  roundTo90,
  type CostInputs,
  type CostSettings,
  type Material,
} from "./calculate";

// Values from docs/Calculadora_Custos_DAN3D.xlsx.
const settings: CostSettings = {
  filament_price_per_kg_cents: 12000,
  energy_price_per_kwh_cents: 100,
  printer_power_w: 150,
  machine_price_cents: 320000,
  machine_life_hours: 5000,
  maintenance_cents: 100000,
  failure_percent: 10,
  labor_rate_per_hour_cents: 1500,
  margin_percent: 100,
};

const materials: Material[] = [
  {
    id: "bag",
    name: "Saco plástico",
    pack_units: 100,
    pack_price_cents: 1490,
    category: "packaging",
  },
  {
    id: "label",
    name: "Etiqueta adesiva",
    pack_units: 92,
    pack_price_cents: 6500,
    category: "packaging",
  },
  {
    id: "kraft",
    name: "Sacola kraft",
    pack_units: 30,
    pack_price_cents: 3600,
    category: "packaging",
  },
  {
    id: "hook",
    name: "Suporte de chaveiro",
    pack_units: 100,
    pack_price_cents: 5000,
    category: "extra",
  },
];

const example: CostInputs = {
  weightG: 70,
  printHours: 2,
  printMinutes: 30,
  finishingMinutes: 10,
  filamentPricePerKgCents: null,
  materials: [
    { materialId: "bag", quantity: 1 },
    { materialId: "label", quantity: 1 },
    { materialId: "kraft", quantity: 1 },
  ],
};

describe("calculateCost", () => {
  it("matches the spreadsheet example", () => {
    const result = calculateCost(settings, example, materials);
    expect(result.printHours).toBe(2.5);
    expect(result.filament).toBeCloseTo(840);
    expect(result.energy).toBeCloseTo(37.5);
    expect(result.depreciation).toBeCloseTo(160);
    expect(result.maintenance).toBeCloseTo(50);
    expect(result.printSubtotal).toBeCloseTo(1087.5);
    expect(result.failures).toBeCloseTo(108.75);
    expect(result.finishing).toBeCloseTo(250);
    expect(result.base).toBeCloseTo(1446.25);
    expect(result.profit).toBeCloseTo(1446.25);
    expect(result.extras).toBe(0);
    expect(result.packaging).toBeCloseTo(205.55, 2);
    expect(result.price).toBeCloseTo(3098.05, 2);
    expect(result.roundedPrice).toBe(3190);
    expect(result.cost).toBeCloseTo(1651.8, 1);
    expect(result.profitAtRoundedPrice).toBeCloseTo(1538.2, 1);
  });

  it("passes extras and packaging on without margin", () => {
    const without = calculateCost(
      settings,
      { ...example, materials: [] },
      materials,
    );
    const withHook = calculateCost(
      settings,
      { ...example, materials: [{ materialId: "hook", quantity: 2 }] },
      materials,
    );
    expect(withHook.extras).toBeCloseTo(100);
    expect(withHook.price - without.price).toBeCloseTo(100);
    expect(withHook.profit).toBeCloseTo(without.profit);
  });

  it("uses the filament price of the piece when given", () => {
    const result = calculateCost(
      settings,
      { ...example, filamentPricePerKgCents: 20000 },
      materials,
    );
    expect(result.filament).toBeCloseTo(1400);
  });

  it("has no profit with zero margin", () => {
    const result = calculateCost(
      { ...settings, margin_percent: 0 },
      example,
      materials,
    );
    expect(result.profit).toBe(0);
    expect(result.price).toBeCloseTo(result.cost);
  });

  it("is zero for an empty piece", () => {
    const result = calculateCost(
      settings,
      {
        ...example,
        weightG: 0,
        printHours: 0,
        printMinutes: 0,
        finishingMinutes: 0,
        materials: [],
      },
      materials,
    );
    expect(result.price).toBe(0);
    expect(result.roundedPrice).toBe(0);
  });

  it("ignores negative or invalid inputs and unknown materials", () => {
    const result = calculateCost(
      settings,
      {
        ...example,
        weightG: -5,
        printHours: Number.NaN,
        printMinutes: 0,
        finishingMinutes: 0,
        materials: [{ materialId: "gone", quantity: 3 }],
      },
      materials,
    );
    expect(result.price).toBe(0);
  });
});

describe("roundTo90", () => {
  it("rounds up to end in ,90", () => {
    expect(roundTo90(3098.05)).toBe(3190);
    expect(roundTo90(3190)).toBe(3190);
    expect(roundTo90(3191)).toBe(3290);
    expect(roundTo90(3195)).toBe(3290);
    expect(roundTo90(3100)).toBe(3190);
    expect(roundTo90(3090)).toBe(3090);
    expect(roundTo90(1)).toBe(90);
  });

  it("keeps zero", () => {
    expect(roundTo90(0)).toBe(0);
    expect(roundTo90(-10)).toBe(0);
  });
});

describe("emptyCostInputs", () => {
  it("starts with the materials used by default", () => {
    const inputs = emptyCostInputs([
      { ...materials[0], default_quantity: 1, used_by_default: true },
      { ...materials[3], default_quantity: 2, used_by_default: false },
    ]);
    expect(inputs.materials).toEqual([{ materialId: "bag", quantity: 1 }]);
    expect(inputs.weightG).toBe(0);
  });
});

describe("parseCostInputs", () => {
  it("reads stored inputs back", () => {
    expect(parseCostInputs(JSON.parse(JSON.stringify(example)))).toEqual(
      example,
    );
  });

  it("replaces broken fields with defaults", () => {
    expect(
      parseCostInputs({
        weightG: "70",
        printHours: 1,
        filamentPricePerKgCents: -1,
        materials: [
          { materialId: "bag", quantity: 0 },
          null,
          { materialId: "label", quantity: 2 },
        ],
      }),
    ).toEqual({
      weightG: 0,
      printHours: 1,
      printMinutes: 0,
      finishingMinutes: 0,
      filamentPricePerKgCents: null,
      materials: [{ materialId: "label", quantity: 2 }],
    });
    expect(parseCostInputs(null)).toBeNull();
    expect(parseCostInputs("x")).toBeNull();
  });
});
