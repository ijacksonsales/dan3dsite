import { describe, expect, it } from "vitest";

import {
  firstDay,
  lastDay,
  monthLabel,
  parseMonth,
  shiftMonth,
  shortMonthLabel,
} from "./months";

describe("months", () => {
  it("parses ?mes= or falls back to the current month", () => {
    expect(parseMonth("2026-09", "2026-10-16")).toBe("2026-09");
    expect(parseMonth("2026-13", "2026-10-16")).toBe("2026-10");
    expect(parseMonth(undefined, "2026-10-16")).toBe("2026-10");
    expect(parseMonth(["2026-09"], "2026-10-16")).toBe("2026-10");
  });

  it("moves across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-10", -5)).toBe("2026-05");
  });

  it("knows the first and last day", () => {
    expect(firstDay("2026-10")).toBe("2026-10-01");
    expect(lastDay("2026-02")).toBe("2026-02-28");
    expect(lastDay("2028-02")).toBe("2028-02-29");
    expect(lastDay("2026-10")).toBe("2026-10-31");
  });

  it("names months in Portuguese", () => {
    expect(monthLabel("2026-03")).toBe("março de 2026");
    expect(shortMonthLabel("2026-10")).toBe("out");
  });
});
