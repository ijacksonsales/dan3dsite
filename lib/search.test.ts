import { describe, expect, it } from "vitest";

import { containsPattern } from "./search";

describe("containsPattern", () => {
  it("wraps the term for a contains search", () => {
    expect(containsPattern("anjo")).toBe("%anjo%");
  });

  it("escapes LIKE wildcards typed by the visitor", () => {
    expect(containsPattern("50%")).toBe("%50\\%%");
    expect(containsPattern("a_b")).toBe("%a\\_b%");
    expect(containsPattern("c:\\x")).toBe("%c:\\\\x%");
  });
});
