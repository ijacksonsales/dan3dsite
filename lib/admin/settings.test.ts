import { describe, expect, it } from "vitest";

import {
  formatInstagram,
  formatWhatsApp,
  parseInstagramInput,
  parseWhatsAppInput,
} from "./settings";

describe("parseWhatsAppInput", () => {
  it("accepts the common ways of typing a Brazilian number", () => {
    for (const input of [
      "(81) 98649-2071",
      "81986492071",
      "+55 81 98649-2071",
      "5581986492071",
    ]) {
      expect(parseWhatsAppInput(input)).toEqual({
        ok: true,
        value: "5581986492071",
      });
    }
    expect(parseWhatsAppInput("(11) 3456-7890")).toEqual({
      ok: true,
      value: "551134567890",
    });
  });

  it("treats an empty field as no number", () => {
    expect(parseWhatsAppInput("  ")).toEqual({ ok: true, value: null });
  });

  it("rejects numbers without the area code", () => {
    expect(parseWhatsAppInput("98649-2071").ok).toBe(false);
    expect(parseWhatsAppInput("1 81 98649-2071").ok).toBe(false);
  });
});

describe("formatWhatsApp", () => {
  it("shows the stored number the way people write it", () => {
    expect(formatWhatsApp("5581986492071")).toBe("(81) 98649-2071");
    expect(formatWhatsApp("551134567890")).toBe("(11) 3456-7890");
    expect(formatWhatsApp(null)).toBe("");
  });

  it("round-trips through the parser", () => {
    const shown = formatWhatsApp("5581986492071");
    expect(parseWhatsAppInput(shown)).toEqual({
      ok: true,
      value: "5581986492071",
    });
  });
});

describe("parseInstagramInput", () => {
  it("accepts a handle or a profile link", () => {
    const expected = { ok: true, value: "https://www.instagram.com/dan3d/" };
    for (const input of [
      "@dan3d",
      "dan3d",
      "instagram.com/dan3d",
      "https://www.instagram.com/dan3d/",
      "https://instagram.com/dan3d?igsh=abc",
    ]) {
      expect(parseInstagramInput(input)).toEqual(expected);
    }
  });

  it("treats an empty field as no profile and rejects other text", () => {
    expect(parseInstagramInput("")).toEqual({ ok: true, value: null });
    expect(parseInstagramInput("minha loja").ok).toBe(false);
    expect(parseInstagramInput("https://facebook.com/dan3d").ok).toBe(false);
  });
});

describe("formatInstagram", () => {
  it("shows the stored link as @handle", () => {
    expect(formatInstagram("https://www.instagram.com/dan3d/")).toBe("@dan3d");
    expect(formatInstagram(null)).toBe("");
  });
});
