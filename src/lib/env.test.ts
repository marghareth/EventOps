// src/lib/env.test.ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  DATABASE_URL: "postgresql://user:pass@localhost:6543/postgres",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/postgres",
};

describe("parseEnv", () => {
  it("accepts a complete environment and defaults AI import to false", () => {
    expect(parseEnv(valid).AI_IMPORT_ENABLED).toBe("false");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: undefined })).toThrow();
  });

  it("rejects an AI_IMPORT_ENABLED value that is not true or false", () => {
    expect(() => parseEnv({ ...valid, AI_IMPORT_ENABLED: "yes" })).toThrow();
  });
});