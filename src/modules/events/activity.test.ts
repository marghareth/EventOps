// src/modules/events/activity.test.ts
// @vitest-environment node
// getEventActivity (B1-11): reads the audit log only after authorizeEvent allows audit.view.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeEvent = vi.fn();
const listAuditEntries = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => "db" }));
vi.mock("./authorize", () => ({ authorizeEvent: (...args: unknown[]) => authorizeEvent(...args) }));
vi.mock("@/modules/events/audit/public", () => ({
  listAuditEntries: (...args: unknown[]) => listAuditEntries(...args),
}));

const { getEventActivity } = await import("./activity");
const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";

beforeEach(() => {
  vi.resetAllMocks();
  listAuditEntries.mockResolvedValue([{ id: "a1" }]);
});

describe("getEventActivity", () => {
  it("authorizes with audit.view, then reads only the authorized event's log", async () => {
    authorizeEvent.mockResolvedValue({ ok: true, user: { id: "u1" }, event: { id: ID } });
    expect(await getEventActivity(ID)).toEqual({ ok: true, entries: [{ id: "a1" }] });
    expect(authorizeEvent).toHaveBeenCalledWith(ID, "audit.view", `/events/${ID}/activity`);
    expect(listAuditEntries).toHaveBeenCalledWith("db", ID);
  });

  it.each([["forbidden"], ["not-found"], ["no-database"]] as const)(
    "reads nothing when refused (%s)",
    async (reason) => {
      authorizeEvent.mockResolvedValue({ ok: false, reason });
      expect(await getEventActivity(ID)).toEqual({ ok: false, reason });
      expect(listAuditEntries).not.toHaveBeenCalled();
    },
  );
});