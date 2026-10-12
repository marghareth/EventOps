// src/app/api/events/route.test.ts
// @vitest-environment node
// GET /api/events (B1-03) with auth and the query mocked. Isolation itself is tested against a
// real database in src/modules/events/queries.db.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

class AuthUnavailableError extends Error {}
const getCurrentUser = vi.fn();
const getMyEvents = vi.fn();

vi.mock("@/lib/auth", () => ({
  AuthUnavailableError,
  getCurrentUser: () => getCurrentUser(),
}));
vi.mock("@/modules/events/public", () => ({
  getMyEvents: (...args: unknown[]) => getMyEvents(...args),
}));

const { GET } = await import("./route");

const listed = {
  id: "e1",
  reference: "EVT-2026-0001",
  name: "Santos wedding",
  venue: null,
  startsAt: new Date("2026-12-12T08:00:00Z"),
  endsAt: null,
  status: "DRAFT",
  expectedAttendees: 0,
  role: "OWNER",
};

beforeEach(() => {
  vi.resetAllMocks();
  getCurrentUser.mockResolvedValue({ id: "user-1", email: "mika@example.com" });
  getMyEvents.mockResolvedValue([listed]);
});

describe("GET /api/events", () => {
  it("answers 401 to a signed-out caller and reads nothing", async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in to continue." });
    expect(getMyEvents).not.toHaveBeenCalled();
  });

  it("lists the signed-in user's events, using the session's user ID", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      events: [{ ...listed, startsAt: "2026-12-12T08:00:00.000Z" }],
    });
    expect(getMyEvents).toHaveBeenCalledWith("user-1");
  });

  it("answers 503 when sign-in is unavailable", async () => {
    getCurrentUser.mockRejectedValue(new AuthUnavailableError());
    expect((await GET()).status).toBe(503);
  });

  it("answers 500 with a safe message when the database fails", async () => {
    getMyEvents.mockRejectedValue(new Error('password authentication failed for user "postgres"'));
    const response = await GET();
    expect(response.status).toBe(500);
    const body = JSON.stringify(await response.json());
    expect(body).toContain("We couldn't load your events");
    expect(body).not.toContain("postgres");
  });
});