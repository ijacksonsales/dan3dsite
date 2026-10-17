import { describe, expect, it } from "vitest";

import {
  formatMoney,
  formatMoneyInput,
  formatNumberInput,
  parseMoneyInput,
  parseNumberInput,
} from "./inputs";

describe("parseNumberInput", () => {
  it("reads numbers typed the Brazilian way", () => {
    expect(parseNumberInput("70")).toEqual({ ok: true, value: 70 });
    expect(parseNumberInput("2,5")).toEqual({ ok: true, value: 2.5 });
    expect(parseNumberInput("1.000")).toEqual({ ok: true, value: 1000 });
  });

  it("treats empty as zero", () => {
    expect(parseNumberInput("  ")).toEqual({ ok: true, value: 0 });
  });

  it("rejects text, negatives and values above the limit", () => {
    expect(parseNumberInput("abc").ok).toBe(false);
    expect(parseNumberInput("-1").ok).toBe(false);
    expect(parseNumberInput("120", { max: 100 }).ok).toBe(false);
  });
});

describe("parseMoneyInput", () => {
  it("returns cents", () => {
    expect(parseMoneyInput("12,90")).toEqual({ ok: true, value: 1290 });
    expect(parseMoneyInput("R$ 3.200")).toEqual({ ok: true, value: 320000 });
    expect(parseMoneyInput("0,95")).toEqual({ ok: true, value: 95 });
    expect(parseMoneyInput("")).toEqual({ ok: true, value: 0 });
  });
});

describe("formatters", () => {
  it("format for inputs and display", () => {
    expect(formatNumberInput(2.5)).toBe("2,5");
    expect(formatNumberInput(1000)).toBe("1000");
    expect(formatNumberInput(0)).toBe("");
    expect(formatMoneyInput(320000)).toBe("3.200,00");
    expect(formatMoney(205.55).replace(/\s/g, " ")).toBe("R$ 2,06");
  });
});
