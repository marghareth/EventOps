// src/lib/auth.test.ts
// @vitest-environment node
// Server-side checks with a mocked Supabase client. No network or database.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const upsert = vi.fn();

vi.mock("./supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));
vi.mock("./db", () => ({ getDb: () => ({ user: { upsert } }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

const { AuthUnavailableError, getCurrentUser, requireUser, syncUserRecord } =
  await import("./auth");

const supabaseUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "Mika@Example.com",
  user_metadata: { display_name: "Mika" },
};

function redirectUrl(promise: Promise<unknown>) {
  return promise.then(
    () => null,
    (e: { url?: string }) => e.url ?? null,
  );
}

beforeEach(() => {
  getUser.mockReset();
  upsert.mockReset();
});
afterEach(() => vi.clearAllMocks());

describe("getCurrentUser", () => {
  it("returns the verified user", async () => {
    getUser.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    await expect(getCurrentUser()).resolves.toEqual({
      id: supabaseUser.id,
      email: supabaseUser.email,
    });
  });

  it("returns null when there is no session", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError", status: 400 },
    });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns null for an expired, revoked or deleted user (4xx)", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", status: 403 },
    });
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("throws, instead of pretending the user is signed out, when Supabase is unreachable", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", status: 0 },
    });
    await expect(getCurrentUser()).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it("throws on a Supabase server error", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", status: 500 },
    });
    await expect(getCurrentUser()).rejects.toBeInstanceOf(AuthUnavailableError);
  });
});

describe("requireUser", () => {
  it("returns the user when signed in", async () => {
    getUser.mockResolvedValue({ data: { user: supabaseUser }, error: null });
    await expect(requireUser("/events")).resolves.toMatchObject({ id: supabaseUser.id });
  });

  it("redirects to login with the next path when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError" } });
    await expect(redirectUrl(requireUser("/events/1"))).resolves.toBe("/login?next=%2Fevents%2F1");
  });

  it("drops an unsafe next path", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError" } });
    await expect(redirectUrl(requireUser("https://evil.example"))).resolves.toBe("/login");
  });
});

describe("syncUserRecord", () => {
  it("upserts the users row with a lower-case email and the sign-up name", async () => {
    upsert.mockResolvedValue({});
    await syncUserRecord(supabaseUser as never);
    expect(upsert).toHaveBeenCalledWith({
      where: { id: supabaseUser.id },
      create: { id: supabaseUser.id, email: "mika@example.com", displayName: "Mika" },
      update: { email: "mika@example.com" },
    });
  });
});