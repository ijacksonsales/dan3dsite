import { describe, expect, it } from "vitest";

import {
  dimensionList,
  formatCm,
  formatDimensions,
  formatPrice,
} from "./format";

describe("formatCm", () => {
  it("converts mm to cm with a decimal comma", () => {
    expect(formatCm(150)).toBe("15 cm");
    expect(formatCm(45)).toBe("4,5 cm");
    expect(formatCm(152.4)).toBe("15,2 cm");
  });

  it("returns null for unknown or invalid sizes", () => {
    expect(formatCm(null)).toBeNull();
    expect(formatCm(0)).toBeNull();
    expect(formatCm(Number.NaN)).toBeNull();
  });
});

describe("formatPrice", () => {
  it("formats cents as reais", () => {
    expect(formatPrice(8900).replace(/\s/g, " ")).toBe("R$ 89,00");
    expect(formatPrice(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });

  it("shows 'Sob consulta' without a price", () => {
    expect(formatPrice(null)).toBe("Sob consulta");
  });
});

describe("formatDimensions", () => {
  it("lists the known measures in cm", () => {
    expect(
      formatDimensions({ height_mm: 150, width_mm: 60, depth_mm: 45 }),
    ).toBe("Altura 15 cm · Largura 6 cm · Profundidade 4,5 cm");
  });

  it("skips missing measures", () => {
    expect(
      dimensionList({ height_mm: 200, width_mm: null, depth_mm: null }),
    ).toEqual([{ label: "Altura", value: "20 cm" }]);
    expect(
      formatDimensions({ height_mm: null, width_mm: null, depth_mm: null }),
    ).toBeNull();
  });
});
