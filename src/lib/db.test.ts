// src/lib/db.test.ts
// @vitest-environment node
// Unit tests for the shared client. No database needed: Prisma connects on the first query.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPrismaClient, getDb } from "./db";

const VALID_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:6543/postgres",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/postgres",
};

function resetSharedClient() {
  delete (globalThis as { eventOpsPrisma?: unknown }).eventOpsPrisma;
}

describe("getDb", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetSharedClient();
  });

  it("throws a validation error when DATABASE_URL is missing", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("DIRECT_URL", VALID_ENV.DIRECT_URL);
    expect(() => getDb()).toThrow();
  });

  it("returns the same client on every call", () => {
    vi.stubEnv("DATABASE_URL", VALID_ENV.DATABASE_URL);
    vi.stubEnv("DIRECT_URL", VALID_ENV.DIRECT_URL);
    const first = getDb();
    expect(getDb()).toBe(first);
  });
});

describe("createPrismaClient", () => {
  it("builds a client without connecting", () => {
    const client = createPrismaClient(VALID_ENV.DATABASE_URL);
    expect(typeof client.event.findMany).toBe("function");
  });
});