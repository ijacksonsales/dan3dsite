import { describe, expect, it } from "vitest";

import {
  bannerState,
  bannerStateLabel,
  buildBannerLink,
  endsAtFromInput,
  endsAtToInput,
  parseBannerLink,
  startsAtFromInput,
  startsAtToInput,
} from "./banners";

describe("bannerState", () => {
  // Brasília time (UTC−3), whatever the machine running the tests uses.
  const at = (day: string) => new Date(`${day}T00:00:00-03:00`);
  const now = new Date("2026-12-15T12:00:00-03:00");
  const window = (starts: Date | null, ends: Date | null, active = true) => ({
    active,
    starts_at: starts?.toISOString() ?? null,
    ends_at: ends?.toISOString() ?? null,
  });

  it("follows the active flag and the display window", () => {
    expect(bannerState(window(null, null), now)).toBe("live");
    expect(bannerState(window(null, null, false), now)).toBe("off");
    expect(bannerState(window(at("2026-12-20"), null), now)).toBe("scheduled");
    expect(bannerState(window(null, at("2026-12-10")), now)).toBe("ended");
  });

  it("shows the last day of a running banner", () => {
    const christmas = window(
      at("2026-12-01"),
      at("2026-12-26"), // exclusive: last day is the 25th
    );
    expect(bannerStateLabel(christmas, now)).toBe("No ar até 25/12");
  });
});

describe("banner dates", () => {
  it("round-trips whole days through the form", () => {
    expect(startsAtToInput(startsAtFromInput("2026-12-01"))).toBe("2026-12-01");
    expect(endsAtToInput(endsAtFromInput("2026-12-25"))).toBe("2026-12-25");
    expect(startsAtFromInput("")).toBeNull();
    expect(endsAtToInput(null)).toBe("");
  });

  it("ends at the next midnight, so the last day is fully shown", () => {
    const end = new Date(endsAtFromInput("2026-12-25")!);
    expect(end.toISOString()).toBe("2026-12-26T03:00:00.000Z");
  });

  it("does not depend on the server's time zone", () => {
    // 25/12 23:30 in Brasília is already 26/12 in UTC.
    expect(startsAtToInput("2026-12-26T02:30:00.000Z")).toBe("2026-12-25");
  });
});

describe("banner links", () => {
  it("reads product, category and external links", () => {
    expect(parseBannerLink("/p/nossa-senhora")).toEqual({
      kind: "product",
      slug: "nossa-senhora",
    });
    expect(parseBannerLink("/c/infantil")).toEqual({
      kind: "category",
      slug: "infantil",
    });
    expect(parseBannerLink("https://instagram.com/dan3d")).toEqual({
      kind: "url",
      url: "https://instagram.com/dan3d",
    });
    expect(parseBannerLink(null)).toEqual({ kind: "none" });
  });

  it("builds the stored link, adding https:// when missing", () => {
    expect(buildBannerLink({ kind: "product", slug: "peca" })).toEqual({
      ok: true,
      value: "/p/peca",
    });
    expect(
      buildBannerLink({ kind: "url", url: "instagram.com/dan3d" }),
    ).toEqual({ ok: true, value: "https://instagram.com/dan3d" });
    expect(buildBannerLink({ kind: "url", url: "promoção" }).ok).toBe(false);
    expect(buildBannerLink({ kind: "category", slug: "" }).ok).toBe(false);
  });
});
