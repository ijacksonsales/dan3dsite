import { describe, expect, it } from "vitest";

import {
  formatCmInput,
  formatPriceInput,
  parseCmInput,
  parsePriceInput,
} from "./product-form";

describe("parsePriceInput", () => {
  it("accepts the usual ways of writing a price", () => {
    expect(parsePriceInput("89,90")).toEqual({ ok: true, value: 8990 });
    expect(parsePriceInput("R$ 89")).toEqual({ ok: true, value: 8900 });
    expect(parsePriceInput("1.250,00")).toEqual({ ok: true, value: 125000 });
    expect(parsePriceInput("89.9")).toEqual({ ok: true, value: 8990 });
  });

  it("empty means “sob consulta”; other text is an error", () => {
    expect(parsePriceInput(" ")).toEqual({ ok: true, value: null });
    expect(parsePriceInput("abc").ok).toBe(false);
    expect(parsePriceInput("0").ok).toBe(false);
  });

  it("round-trips through the input format", () => {
    expect(formatPriceInput(125000)).toBe("1.250,00");
    expect(parsePriceInput(formatPriceInput(125000))).toEqual({
      ok: true,
      value: 125000,
    });
    expect(formatPriceInput(null)).toBe("");
  });
});

describe("parseCmInput", () => {
  it("converts centimeters to millimeters", () => {
    expect(parseCmInput("15,2")).toEqual({ ok: true, value: 152 });
    expect(parseCmInput("15.25 cm")).toEqual({ ok: true, value: 152.5 });
    expect(parseCmInput("")).toEqual({ ok: true, value: null });
    expect(parseCmInput("-3").ok).toBe(false);
  });

  it("shows millimeters as centimeters", () => {
    expect(formatCmInput(152)).toBe("15,2");
    expect(formatCmInput(45)).toBe("4,5");
    expect(formatCmInput(null)).toBe("");
  });
});
