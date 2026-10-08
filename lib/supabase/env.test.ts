import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabasePublicEnv } from "./env";

describe("getSupabasePublicEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns the public Supabase settings", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(getSupabasePublicEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon",
    });
  });

  it("fails loudly when a variable is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(() => getSupabasePublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
