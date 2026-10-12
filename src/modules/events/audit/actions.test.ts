// src/modules/events/audit/actions.test.ts
// @vitest-environment node
// The audit action registry (B1-11, D-037): only listed actions, only listed fields.
import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, eventChangesSchema, isAuditAction, readAuditDetails } from "./actions";

describe("audit action registry", () => {
  it("is a short, controlled list of business actions", () => {
    expect(Object.keys(AUDIT_ACTIONS)).toEqual(["event.created", "event.updated"]);
    for (const action of Object.keys(AUDIT_ACTIONS)) expect(action).toMatch(/^[a-z_]+\.[a-z_]+$/);
  });

  it("knows its own actions only", () => {
    expect(isAuditAction("event.updated")).toBe(true);
    expect(isAuditAction("event.viewed")).toBe(false);
    expect(isAuditAction("toString")).toBe(false);
  });

  it("accepts the documented details", () => {
    expect(
      AUDIT_ACTIONS["event.created"].details.parse({ reference: "EVT-2026-0001", name: "Gala" }),
    ).toEqual({ reference: "EVT-2026-0001", name: "Gala" });
    expect(
      eventChangesSchema.parse({
        venue: { from: "Cebu", to: "Manila" },
        description: { changed: true },
        endsAt: { from: null, to: "2026-12-12T14:00:00.000Z" },
      }),
    ).toBeTruthy();
  });

  it.each([
    ["an unlisted field", { reference: "EVT-2026-0001", name: "Gala", email: "a@b.c" }],
    ["a missing field", { reference: "EVT-2026-0001" }],
  ])("refuses event.created details with %s", (_label, details) => {
    expect(AUDIT_ACTIONS["event.created"].details.safeParse(details).success).toBe(false);
  });

  it.each([
    ["an unlisted field", { changes: { status: { from: "DRAFT", to: "LIVE" } } }],
    ["the description text", { changes: { description: { from: "a", to: "b" } } }],
    ["no changes at all", { changes: {} }],
    ["a malformed date", { changes: { startsAt: { from: "yesterday", to: "today" } } }],
  ])("refuses event.updated details with %s", (_label, details) => {
    expect(AUDIT_ACTIONS["event.updated"].details.safeParse(details).success).toBe(false);
  });

  it("validates stored entries on read, and gives up on unknown or bad ones", () => {
    expect(readAuditDetails("event.created", { reference: "EVT-2026-0001", name: "Gala" })).toEqual(
      {
        action: "event.created",
        details: { reference: "EVT-2026-0001", name: "Gala" },
      },
    );
    expect(readAuditDetails("event.archived", {})).toBeNull();
    expect(readAuditDetails("event.created", { name: 5 })).toBeNull();
  });
});