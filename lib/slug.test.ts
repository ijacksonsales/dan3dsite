import { describe, expect, it } from "vitest";

import { isValidSlug, slugify } from "./slug";

describe("slugify", () => {
  it("drops accents, symbols and case", () => {
    expect(slugify("Nossa Senhora Aparecida (15 cm)")).toBe(
      "nossa-senhora-aparecida-15-cm",
    );
    expect(slugify("  Presépio & Natal!  ")).toBe("presepio-natal");
    expect(slugify("Ação de Graças")).toBe("acao-de-gracas");
  });

  it("returns an empty slug when nothing is left", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("keeps slugs short and without a trailing dash", () => {
    const slug = slugify("a".repeat(59) + " bcd");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it("accepts what slugify produces and nothing else", () => {
    expect(isValidSlug("infantil")).toBe(true);
    expect(isValidSlug("nossa-senhora-15-cm")).toBe(true);
    for (const slug of ["", "-a", "a-", "a--b", "Ação", "a b"]) {
      expect(isValidSlug(slug)).toBe(false);
    }
  });
});
