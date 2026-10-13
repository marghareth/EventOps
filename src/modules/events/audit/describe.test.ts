// src/modules/events/audit/describe.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { describeAuditEntry, formatAuditTime } from "./describe";

describe("describeAuditEntry", () => {
  it("describes a created event", () => {
    expect(
      describeAuditEntry({
        action: "event.created",
        details: { reference: "EVT-2026-0001", name: "Gala" },
      }),
    ).toEqual({ summary: "Created the event EVT-2026-0001", lines: [] });
  });

  it("lists each changed field, old → new, in a fixed order", () => {
    expect(
      describeAuditEntry({
        action: "event.updated",
        details: {
          changes: {
            expectedAttendees: { from: 180, to: 1220 },
            venue: { from: "Cebu", to: null },
            description: { changed: true },
            startsAt: { from: "2026-12-12T08:00:00.000Z", to: "2026-12-12T09:30:00.000Z" },
          },
        },
      }),
    ).toEqual({
      summary: "Edited the event details",
      lines: [
        "Venue: “Cebu” → none",
        "Description changed",
        "Start: Dec 12, 2026, 4:00 PM PHT → Dec 12, 2026, 5:30 PM PHT",
        "Expected attendees: 180 → 1,220",
      ],
    });
  });

  it("describes added and removed attendees by name and readable ID", () => {
    const who = { reference: "ATT-0001", name: "Maria Santos" };
    expect(describeAuditEntry({ action: "attendee.created", details: who }).summary).toBe(
      "Added the attendee Maria Santos (ATT-0001)",
    );
    expect(describeAuditEntry({ action: "attendee.deleted", details: who }).summary).toBe(
      "Removed the attendee Maria Santos (ATT-0001)",
    );
  });

  it("lists attendee changes, personal ones without values", () => {
    expect(
      describeAuditEntry({
        action: "attendee.updated",
        details: {
          reference: "ATT-0002",
          changes: {
            notes: { changed: true },
            rsvpStatus: { from: "PENDING", to: "CONFIRMED" },
            plusOnes: { from: 0, to: 2 },
            category: { from: null, to: "Family" },
          },
        },
      }),
    ).toEqual({
      summary: "Edited the attendee ATT-0002",
      lines: [
        "RSVP: Pending → Confirmed",
        "Plus-ones: 0 → 2",
        "Category: none → “Family”",
        "Notes changed",
      ],
    });
  });

  it("falls back safely for an entry it cannot read", () => {
    expect(describeAuditEntry({ action: null, details: null })).toEqual({
      summary: "Made a change (details unavailable)",
      lines: [],
    });
  });

  it("formats times in Philippine time", () => {
    expect(formatAuditTime(new Date("2026-12-31T16:30:00Z"))).toBe("Jan 1, 2027, 12:30 AM PHT");
  });
});