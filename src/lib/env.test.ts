// src/lib/env.test.ts
import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("parsePublicEnv", () => {
  it("accepts a complete public environment", () => {
    expect(parsePublicEnv(valid).NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
  });

  it("rejects a Supabase URL that is not a URL", () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow();
  });

  it("rejects a missing anon key", () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined })).toThrow();
  });
});