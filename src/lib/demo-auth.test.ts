// src/lib/demo-auth.test.ts
// @vitest-environment node
// The dev-only demo sign-in must be impossible to switch on outside `next dev` (D-024).
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";
import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "../../next.config";
import { DEMO_EVENT_ID, DEMO_USER, assertDemoAuthNotInBuild, isDemoAuthEnabled } from "./demo-auth";

afterEach(() => vi.unstubAllEnvs());

describe("isDemoAuthEnabled", () => {
  it("is on only with DEV_DEMO_AUTH=true under NODE_ENV=development", () => {
    expect(isDemoAuthEnabled({ DEV_DEMO_AUTH: "true", NODE_ENV: "development" })).toBe(true);
  });

  it.each([
    ["production (next start, Vercel)", { DEV_DEMO_AUTH: "true", NODE_ENV: "production" }],
    ["tests", { DEV_DEMO_AUTH: "true", NODE_ENV: "test" }],
    ["no NODE_ENV", { DEV_DEMO_AUTH: "true" }],
    ["flag off", { DEV_DEMO_AUTH: "false", NODE_ENV: "development" }],
    ["flag missing", { NODE_ENV: "development" }],
    ["flag not exactly 'true'", { DEV_DEMO_AUTH: "TRUE", NODE_ENV: "development" }],
    ["flag '1'", { DEV_DEMO_AUTH: "1", NODE_ENV: "development" }],
  ])("is off for %s", (_label, env) => {
    expect(isDemoAuthEnabled(env)).toBe(false);
  });

  it("is off in this test run even if the flag is set", () => {
    vi.stubEnv("DEV_DEMO_AUTH", "true");
    expect(isDemoAuthEnabled()).toBe(false);
  });
});

describe("build guard", () => {
  it("refuses a production build with the flag set", () => {
    vi.stubEnv("DEV_DEMO_AUTH", "true");
    expect(() => nextConfig(PHASE_PRODUCTION_BUILD)).toThrow(/DEV_DEMO_AUTH=true/);
    expect(() => assertDemoAuthNotInBuild()).toThrow();
  });

  it("allows a production build without the flag", () => {
    vi.stubEnv("DEV_DEMO_AUTH", "false");
    expect(() => nextConfig(PHASE_PRODUCTION_BUILD)).not.toThrow();
  });

  it("allows the dev server with the flag", () => {
    vi.stubEnv("DEV_DEMO_AUTH", "true");
    expect(() => nextConfig(PHASE_DEVELOPMENT_SERVER)).not.toThrow();
  });
});

describe("demo identities", () => {
  it("uses valid UUIDs, so the event pages and the users table accept them", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(DEMO_USER.id).toMatch(uuid);
    expect(DEMO_EVENT_ID).toMatch(uuid);
  });
});