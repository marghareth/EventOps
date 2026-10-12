// src/app/api/events/[eventId]/route.test.ts
// @vitest-environment node
// GET /api/events/<id> (B1-04, B1-09) with sign-in and the membership lookup mocked.
import { beforeEach, describe, expect, it, vi } from "vitest";

class AuthUnavailableError extends Error {}
const getCurrentUser = vi.fn();
const getEventAccess = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  AuthUnavailableError,
  getCurrentUser: () => getCurrentUser(),
  requireUser: vi.fn(),
}));
// The route authorizes through authorizeEventRequest (B1-09); only its membership lookup is mocked.
vi.mock("@/modules/events/access", () => ({
  getEventAccess: (...args: unknown[]) => getEventAccess(...args),
  requireEventAccess: vi.fn(),
}));
vi.mock("@/modules/events/actions", () => ({}));
vi.mock("@/modules/events/queries", () => ({}));

const { GET } = await import("./route");

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const call = (eventId = ID) =>
  GET(new Request(`http://localhost/api/events/${eventId}`), {
    params: Promise.resolve({ eventId }),
  });

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue({ id: "user-1", email: "mika@example.com" });
});

describe("GET /api/events/[eventId]", () => {
  it("answers 401 to a signed-out caller and reads nothing", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(getEventAccess).not.toHaveBeenCalled();
  });

  it("returns a member's event using the session's user ID", async () => {
    getEventAccess.mockResolvedValue({
      kind: "ok",
      event: { id: ID, name: "Santos wedding", role: "VIEWER" },
    });
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      event: { id: ID, name: "Santos wedding", role: "VIEWER" },
    });
    expect(getEventAccess).toHaveBeenCalledWith("user-1", ID);
  });

  it("answers the same 404 for another user's event, an unknown one or a malformed ID", async () => {
    getEventAccess.mockResolvedValue({ kind: "not-found" });
    const bodies = [];
    for (const id of [ID, "not-a-uuid"]) {
      const response = await call(id);
      expect(response.status).toBe(404);
      bodies.push(await response.json());
    }
    expect(bodies).toEqual([{ error: "Event not found." }, { error: "Event not found." }]);
  });

  it("answers 503 when sign-in or (demo) the database is unavailable", async () => {
    getEventAccess.mockResolvedValue({ kind: "no-database" });
    expect((await call()).status).toBe(503);
    getCurrentUser.mockRejectedValue(new AuthUnavailableError());
    expect((await call()).status).toBe(503);
  });

  it("answers 500 with a safe message when the database fails", async () => {
    getEventAccess.mockRejectedValue(new Error('relation "events" does not exist'));
    const response = await call();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("relation");
  });
});