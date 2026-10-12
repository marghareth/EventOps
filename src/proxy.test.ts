// src/proxy.test.ts
// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updateSession = vi.fn();
const redirectWithSession = vi.fn();
let demo = false;

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: (...args: unknown[]) => updateSession(...args),
  redirectWithSession: (...args: unknown[]) => redirectWithSession(...args),
}));
vi.mock("@/lib/demo-auth", () => ({ isDemoAuthEnabled: () => demo }));

const { proxy } = await import("./proxy");

function request(path: string) {
  return new NextRequest(`https://eventops.example${path}`);
}

beforeEach(() => {
  demo = false;
  updateSession.mockReset();
  redirectWithSession.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("proxy", () => {
  it("sends a signed-out visitor of a protected page to login", async () => {
    const session = { hasSession: false, response: new Response(null) };
    updateSession.mockResolvedValue(session);
    redirectWithSession.mockReturnValue("redirect");
    await expect(proxy(request("/events"))).resolves.toBe("redirect");
    expect(redirectWithSession).toHaveBeenCalledWith(
      expect.anything(),
      session,
      "/login?next=%2Fevents",
    );
  });

  it("lets a signed-in user through with the refreshed session response", async () => {
    const session = { hasSession: true, response: "session-response" };
    updateSession.mockResolvedValue(session);
    await expect(proxy(request("/events"))).resolves.toBe("session-response");
  });

  it("in demo mode, skips Supabase entirely and redirects nothing", async () => {
    demo = true;
    for (const path of ["/events", "/login", "/sign-up"]) {
      const response = await proxy(request(path));
      expect(response.headers.get("location")).toBeNull();
    }
    expect(updateSession).not.toHaveBeenCalled();
  });
});