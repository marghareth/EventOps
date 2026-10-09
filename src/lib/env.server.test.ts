// src/lib/env.server.test.ts
import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env.server";

const valid = {
  DATABASE_URL: "postgresql://user:pass@localhost:6543/postgres",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/postgres",
};

describe("parseServerEnv", () => {
  it("accepts a complete server environment and defaults AI import to false", () => {
    expect(parseServerEnv(valid).AI_IMPORT_ENABLED).toBe("false");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: undefined })).toThrow();
  });

  it("rejects an AI_IMPORT_ENABLED value that is not true or false", () => {
    expect(() => parseServerEnv({ ...valid, AI_IMPORT_ENABLED: "yes" })).toThrow();
  });
});