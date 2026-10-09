// src/app/auth/confirm/route.test.ts
// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn(), signOut: vi.fn() };
const syncUserRecord = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth }) }));
vi.mock("@/lib/auth", () => ({ syncUserRecord: (...args: unknown[]) => syncUserRecord(...args) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

const { GET } = await import("./route");

const user = { id: "u1", email: "mika@example.com" };

async function visit(query: string): Promise<string> {
  try {
    await GET(new NextRequest(`https://eventops.example/auth/confirm${query}`));
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return url;
    throw error;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.signOut.mockResolvedValue({ error: null });
  syncUserRecord.mockResolvedValue(undefined);
});

describe("GET /auth/confirm", () => {
  it("verifies a token_hash link, syncs the user and goes to next", async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user }, error: null });
    await expect(visit("?token_hash=abc&type=signup&next=%2Fevents%2F2")).resolves.toBe(
      "/events/2",
    );
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "abc" });
    expect(syncUserRecord).toHaveBeenCalledWith(user);
  });

  it("exchanges a PKCE code link", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: { user }, error: null });
    await expect(visit("?code=xyz")).resolves.toBe("/events");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("xyz");
  });

  it("rejects link types outside this task, such as password recovery", async () => {
    await expect(visit("?token_hash=abc&type=recovery")).resolves.toBe("/login?error=confirm");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("sends an expired or invalid link to login with a known error key", async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user: null }, error: { code: "otp_expired" } });
    await expect(visit("?token_hash=old&type=email")).resolves.toBe("/login?error=confirm");
    expect(syncUserRecord).not.toHaveBeenCalled();
  });

  it("treats a link with no token as invalid", async () => {
    await expect(visit("")).resolves.toBe("/login?error=confirm");
  });

  it("never follows an off-site next path", async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user }, error: null });
    await expect(visit("?token_hash=abc&type=email&next=//evil.example")).resolves.toBe("/events");
  });

  it("signs back out when the users row cannot be saved", async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user }, error: null });
    syncUserRecord.mockRejectedValue(new Error("db down"));
    await expect(visit("?token_hash=abc&type=email")).resolves.toBe("/login?error=unavailable");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});