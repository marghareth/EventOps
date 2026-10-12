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