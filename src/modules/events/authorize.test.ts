// src/modules/events/authorize.test.ts
// @vitest-environment node
// The authorization helpers (B1-09, D-036) with sign-in and the membership lookup mocked. The same
// rules run end to end against a real database in authorization.db.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

class AuthUnavailableError extends Error {}
const requireUser = vi.fn();
const getCurrentUser = vi.fn();
const getEventAccess = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  AuthUnavailableError,
  requireUser: (...args: unknown[]) => requireUser(...args),
  getCurrentUser: () => getCurrentUser(),
}));
vi.mock("./access", () => ({ getEventAccess: (...args: unknown[]) => getEventAccess(...args) }));

const { authorizeEvent, authorizeEventRequest } = await import("./authorize");

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const user = { id: "user-1", email: "mika@example.com" };
const member = (role: string) => ({ kind: "ok", event: { id: ID, role } });

beforeEach(() => {
  vi.resetAllMocks();
  requireUser.mockResolvedValue(user);
  getCurrentUser.mockResolvedValue(user);
});

describe("authorizeEvent (server actions)", () => {
  it("verifies sign-in first, returning to the given path, and stops if signed out", async () => {
    requireUser.mockRejectedValue(Object.assign(new Error("NEXT_REDIRECT"), { url: "/login" }));
    await expect(authorizeEvent(ID, "event.edit", "/back/here")).rejects.toMatchObject({
      url: "/login",
    });
    expect(requireUser).toHaveBeenCalledWith("/back/here");
    expect(getEventAccess).not.toHaveBeenCalled();
  });

  it("checks membership for the user from the session", async () => {
    getEventAccess.mockResolvedValue(member("OWNER"));
    expect(await authorizeEvent(ID, "event.delete")).toEqual({
      ok: true,
      user,
      event: { id: ID, role: "OWNER" },
    });
    expect(requireUser).toHaveBeenCalledWith(`/events/${ID}`);
    expect(getEventAccess).toHaveBeenCalledWith("user-1", ID);
  });

  it.each([
    ["VIEWER", "event.edit"],
    ["VIEWER", "event.delete"],
    ["COORDINATOR", "event.delete"],
    ["COORDINATOR", "members.manage"],
  ] as const)("refuses a %s for %s", async (role, permission) => {
    getEventAccess.mockResolvedValue(member(role));
    expect(await authorizeEvent(ID, permission)).toEqual({ ok: false, reason: "forbidden" });
  });

  it.each([["not-found"], ["no-database"]] as const)("passes on %s", async (kind) => {
    getEventAccess.mockResolvedValue({ kind });
    expect(await authorizeEvent(ID, "event.view")).toEqual({ ok: false, reason: kind });
  });
});

describe("authorizeEventRequest (API route handlers)", () => {
  async function status(permission: "event.view" | "event.edit" | "event.delete" = "event.edit") {
    const result = await authorizeEventRequest(ID, permission);
    return result.ok ? 200 : result.response.status;
  }

  it("answers 401 signed out, without looking up the event", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await status()).toBe(401);
    expect(getEventAccess).not.toHaveBeenCalled();
  });

  it("answers 404 for a non-member exactly as for an unknown event", async () => {
    getEventAccess.mockResolvedValue({ kind: "not-found" });
    const result = await authorizeEventRequest(ID, "event.view");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
      expect(await result.response.json()).toEqual({ error: "Event not found." });
      expect(result.response.headers.get("Cache-Control")).toBe("private, no-store");
    }
  });

  it("answers 403 for a member whose role lacks the permission (D-036)", async () => {
    getEventAccess.mockResolvedValue(member("VIEWER"));
    expect(await status("event.edit")).toBe(403);
    getEventAccess.mockResolvedValue(member("COORDINATOR"));
    expect(await status("event.delete")).toBe(403);
  });

  it("allows a member whose role has the permission", async () => {
    getEventAccess.mockResolvedValue(member("VIEWER"));
    expect(await status("event.view")).toBe(200);
    getEventAccess.mockResolvedValue(member("OWNER"));
    expect(await status("event.delete")).toBe(200);
  });

  it("answers 503 when sign-in or the demo database is unavailable", async () => {
    getEventAccess.mockResolvedValue({ kind: "no-database" });
    expect(await status()).toBe(503);
    getCurrentUser.mockRejectedValue(new AuthUnavailableError());
    expect(await status()).toBe(503);
  });

  it("answers 500 with a safe message on a database error", async () => {
    getEventAccess.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5"));
    const result = await authorizeEventRequest(ID, "event.view");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(500);
      expect(await result.response.text()).not.toContain("ECONNREFUSED");
    }
  });
});