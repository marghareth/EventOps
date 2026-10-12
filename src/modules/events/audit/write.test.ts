// src/modules/events/audit/write.test.ts
// @vitest-environment node
// writeAudit (B1-11): registered actions only, validated details, entity type from the registry.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { writeAudit } = await import("./write");

function client() {
  const create = vi.fn().mockResolvedValue({});
  return { create, tx: { auditLog: { create } } as never };
}

describe("writeAudit", () => {
  it("writes one entry with the registry's entity type", async () => {
    const { create, tx } = client();
    await writeAudit(tx, {
      eventId: "e1",
      actorId: "u1",
      action: "event.updated",
      entityId: "e1",
      details: { changes: { venue: { from: "Cebu", to: "Manila" } } },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        eventId: "e1",
        actorId: "u1",
        action: "event.updated",
        entityType: "event",
        entityId: "e1",
        details: { changes: { venue: { from: "Cebu", to: "Manila" } } },
      },
    });
  });

  it("refuses details with unlisted fields and writes nothing", async () => {
    const { create, tx } = client();
    await expect(
      writeAudit(tx, {
        eventId: "e1",
        actorId: "u1",
        action: "event.created",
        entityId: "e1",
        details: { reference: "EVT-2026-0001", name: "Gala", phone: "0917" } as never,
      }),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses an action that is not in the registry", async () => {
    const { create, tx } = client();
    await expect(
      writeAudit(tx, {
        eventId: "e1",
        actorId: "u1",
        action: "event.viewed" as never,
        entityId: "e1",
        details: {} as never,
      }),
    ).rejects.toThrow("Unknown audit action");
    expect(create).not.toHaveBeenCalled();
  });

  it("lets a database failure through so the surrounding transaction rolls back", async () => {
    const create = vi.fn().mockRejectedValue(new Error("foreign key"));
    await expect(
      writeAudit({ auditLog: { create } } as never, {
        eventId: "e1",
        actorId: "u1",
        action: "event.created",
        entityId: "e1",
        details: { reference: "EVT-2026-0001", name: "Gala" },
      }),
    ).rejects.toThrow("foreign key");
  });
});