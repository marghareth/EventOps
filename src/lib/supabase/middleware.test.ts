// src/lib/supabase/middleware.test.ts
// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CookieMethods = {
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookies: { name: string; value: string; options: Record<string, unknown> }[],
    headers: Record<string, string>,
  ) => void;
};

let getClaims: () => Promise<unknown>;
let captured: CookieMethods | undefined;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: CookieMethods }) => {
    captured = options.cookies;
    return { auth: { getClaims: () => getClaims() } };
  },
}));

const { redirectWithSession, updateSession } = await import("./middleware");

const NO_STORE = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

function request(path = "/events") {
  return new NextRequest(`https://eventops.example${path}`, {
    headers: { cookie: "sb-test-auth-token=old" },
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  captured = undefined;
});
afterEach(() => vi.unstubAllEnvs());

describe("updateSession", () => {
  it("reports a session when the token's claims verify", async () => {
    getClaims = async () => ({ data: { claims: { sub: "user-1" } }, error: null });
    const result = await updateSession(request());
    expect(result.hasSession).toBe(true);
  });

  it("reports no session when verification fails", async () => {
    getClaims = async () => ({ data: null, error: { message: "invalid JWT" } });
    expect((await updateSession(request())).hasSession).toBe(false);
  });

  it("reports no session when there are no claims", async () => {
    getClaims = async () => ({ data: { claims: null }, error: null });
    expect((await updateSession(request())).hasSession).toBe(false);
  });

  it("passes the request cookies to Supabase", async () => {
    getClaims = async () => ({ data: null, error: null });
    await updateSession(request());
    expect(captured?.getAll()).toContainEqual({ name: "sb-test-auth-token", value: "old" });
  });

  it("writes refreshed cookies and no-store headers onto the response", async () => {
    getClaims = async () => {
      captured?.setAll(
        [{ name: "sb-test-auth-token", value: "new", options: { path: "/" } }],
        NO_STORE,
      );
      return { data: { claims: { sub: "user-1" } }, error: null };
    };
    const { response } = await updateSession(request());
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("new");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

describe("redirectWithSession", () => {
  it("keeps refreshed cookies and no-store headers on the redirect", async () => {
    getClaims = async () => {
      captured?.setAll(
        [{ name: "sb-test-auth-token", value: "new", options: { path: "/" } }],
        NO_STORE,
      );
      return { data: { claims: { sub: "user-1" } }, error: null };
    };
    const req = request("/login");
    const session = await updateSession(req);
    const redirect = redirectWithSession(req, session, "/events");

    expect(redirect.status).toBe(307);
    expect(redirect.headers.get("location")).toBe("https://eventops.example/events");
    expect(redirect.cookies.get("sb-test-auth-token")?.value).toBe("new");
    expect(redirect.headers.get("cache-control")).toContain("no-store");
  });
});