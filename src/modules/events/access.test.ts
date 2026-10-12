// src/modules/events/access.test.ts
// @vitest-environment node
// The event access check (B1-04, D-027) with auth and the database mocked. Isolation against a real
// database is tested in queries.db.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUser = vi.fn();
const getEventForMember = vi.fn();
let noDatabase = false;

vi.mock("server-only", () => ({}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));
vi.mock("@/lib/auth", () => ({ requireUser: (...args: unknown[]) => requireUser(...args) }));
vi.mock("@/lib/db", () => ({ getDb: () => "db" }));
vi.mock("@/lib/demo-auth", () => ({ isDemoWithoutDatabase: () => noDatabase }));
vi.mock("./queries", () => ({
  getEventForMember: (...args: unknown[]) => getEventForMember(...args),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });
  },
}));

const { getEventAccess, requireEventAccess } = await import("./access");

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const user = { id: "user-1", email: "mika@example.com" };
const event = { id: ID, name: "Santos wedding", role: "OWNER" };

beforeEach(() => {
  vi.resetAllMocks();
  noDatabase = false;
  requireUser.mockResolvedValue(user);
});

describe("getEventAccess", () => {
  it("returns the event for a member, asking the database with the given user", async () => {
    getEventForMember.mockResolvedValue(event);
    expect(await getEventAccess("user-1", ID)).toEqual({ kind: "ok", event });
    expect(getEventForMember).toHaveBeenCalledWith("db", ID, "user-1");
  });

  it("returns not-found for a non-member or an unknown event", async () => {
    getEventForMember.mockResolvedValue(null);
    expect(await getEventAccess("user-1", ID)).toEqual({ kind: "not-found" });
  });

  it.each(["new-thing", "1", "' OR 1=1 --", "3f2c1b8e-9a4d-4c1e-8b2a"])(
    "returns not-found for the malformed ID %j without a query",
    async (eventId) => {
      expect(await getEventAccess("user-1", eventId)).toEqual({ kind: "not-found" });
      expect(getEventForMember).not.toHaveBeenCalled();
    },
  );

  it("reports demo mode without a database", async () => {
    noDatabase = true;
    expect(await getEventAccess("user-1", ID)).toEqual({ kind: "no-database" });
    expect(getEventForMember).not.toHaveBeenCalled();
  });

  it("lets database errors through to the error page", async () => {
    getEventForMember.mockRejectedValue(new Error("connection refused"));
    await expect(getEventAccess("user-1", ID)).rejects.toThrow("connection refused");
  });
});

describe("requireEventAccess", () => {
  it("requires sign-in, returning to the event afterwards", async () => {
    requireUser.mockRejectedValue(Object.assign(new Error("NEXT_REDIRECT"), { url: "/login" }));
    await expect(requireEventAccess(ID)).rejects.toMatchObject({ url: "/login" });
    expect(requireUser).toHaveBeenCalledWith(`/events/${ID}`);
    expect(getEventForMember).not.toHaveBeenCalled();
  });

  it("returns the signed-in user and their event", async () => {
    getEventForMember.mockResolvedValue(event);
    expect(await requireEventAccess(ID)).toEqual({ user, access: { kind: "ok", event } });
  });

  it("shows not found for another user's event, exactly as for an unknown one", async () => {
    getEventForMember.mockResolvedValue(null);
    await expect(requireEventAccess(ID)).rejects.toMatchObject({ notFound: true });
  });

  it("encodes an odd ID in the sign-in return path", async () => {
    requireUser.mockRejectedValue(new Error("stop"));
    await expect(requireEventAccess("a/b?x")).rejects.toThrow();
    expect(requireUser).toHaveBeenCalledWith("/events/a%2Fb%3Fx");
  });
});