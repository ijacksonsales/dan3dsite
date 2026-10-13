import { describe, expect, it } from "vitest";

import { safeAdminPath } from "./paths";

describe("safeAdminPath", () => {
  it("keeps admin pages, including their query", () => {
    expect(safeAdminPath("/admin")).toBe("/admin");
    expect(safeAdminPath("/admin/produtos?status=draft")).toBe(
      "/admin/produtos?status=draft",
    );
  });

  it("falls back to the admin home for anything else", () => {
    for (const next of [
      null,
      "",
      "/",
      "/p/peca",
      "/administrador",
      "/admin/login",
      "//evil.example/admin",
      "/\\evil.example",
      "https://evil.example/admin",
    ]) {
      expect(safeAdminPath(next)).toBe("/admin");
    }
  });
});
