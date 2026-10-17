// src/modules/events/audit/actions.test.ts
// @vitest-environment node
// The audit action registry (B1-11, D-037): only listed actions, only listed fields.
import { describe, expect, it } from "vitest";
import { RsvpStatus } from "@/generated/prisma/client";
import {
  AUDIT_ACTIONS,
  RSVP_STATUSES,
  attendeeChangesSchema,
  eventChangesSchema,
  isAuditAction,
  readAuditDetails,
} from "./actions";

describe("audit action registry", () => {
  it("is a short, controlled list of business actions", () => {
    expect(Object.keys(AUDIT_ACTIONS)).toEqual([
      "event.created",
      "event.updated",
      "attendee.created",
      "attendee.updated",
      "attendee.deleted",
      "attendees.exported",
      "attendees.imported",
      "accessibility_requirement.created",
      "accessibility_requirement.updated",
      "accessibility_requirement.deleted",
      "accessibility_resource.created",
      "accessibility_resource.updated",
      "accessibility_resource.deleted",
      "supplier.created",
      "supplier.updated",
      "supplier.deleted",
      "quote.created",
      "quote.updated",
      "payment.created",
      "payment.updated",
      "budget_category.created",
      "budget_category.updated",
      "budget_category.deleted",
      "budget_item.created",
      "budget_item.updated",
      "budget_item.deleted",
      "task.created",
      "task.updated",
    ]);
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

  it("keeps the RSVP list equal to the database enum (D-042)", () => {
    expect([...RSVP_STATUSES].sort()).toEqual(Object.values(RsvpStatus).sort());
  });

  it("accepts the documented attendee details", () => {
    const who = { reference: "ATT-0001", name: "Maria Santos" };
    expect(AUDIT_ACTIONS["attendee.created"].details.parse(who)).toEqual(who);
    expect(AUDIT_ACTIONS["attendee.deleted"].details.parse(who)).toEqual(who);
    expect(
      AUDIT_ACTIONS["attendee.updated"].details.parse({
        reference: "ATT-0184",
        changes: {
          rsvpStatus: { from: "PENDING", to: "CONFIRMED" },
          plusOnes: { from: 0, to: 2 },
          email: { changed: true },
        },
      }),
    ).toBeTruthy();
  });

  it.each([
    ["an email", { reference: "ATT-0001", name: "Maria", email: "a@b.c" }],
    ["a malformed reference", { reference: "EVT-2026-0001", name: "Maria" }],
    ["a missing name", { reference: "ATT-0001" }],
  ])("refuses attendee.created details with %s", (_label, details) => {
    expect(AUDIT_ACTIONS["attendee.created"].details.safeParse(details).success).toBe(false);
  });

  it.each([
    ["the email address", { email: { from: "a@b.c", to: "d@e.f" } }],
    ["the phone number", { phone: { from: "0917", to: "0918" } }],
    ["the dietary needs", { dietaryNeeds: { from: "Vegan", to: "None" } }],
    ["the notes", { notes: { from: "a", to: "b" } }],
    ["an RSVP outside the list", { rsvpStatus: { from: "PENDING", to: "ATTENDING" } }],
    ["an unlisted field", { number: { from: 1, to: 2 } }],
    ["no changes at all", {}],
  ])("refuses attendee changes with %s", (_label, changes) => {
    expect(attendeeChangesSchema.safeParse(changes).success).toBe(false);
  });
});