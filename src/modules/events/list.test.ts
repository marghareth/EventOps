// src/modules/events/list.test.ts
// @vitest-environment node
// Event list rules (B1-03): Philippine-time display, grouping and order.
import { describe, expect, it } from "vitest";
import {
  formatEventWhen,
  formatExpectedAttendees,
  groupEvents,
  manilaDay,
  type EventListItem,
} from "./list";

function item(reference: string, startsAt: string, endsAt: string | null = null): EventListItem {
  return {
    id: reference,
    reference,
    name: reference,
    venue: null,
    startsAt: new Date(startsAt),
    endsAt: endsAt ? new Date(endsAt) : null,
    status: "DRAFT",
    expectedAttendees: 0,
    role: "OWNER",
  };
}

describe("formatEventWhen", () => {
  it("shows the date and start in Philippine time", () => {
    expect(formatEventWhen(new Date("2026-12-12T08:00:00Z"), null)).toBe(
      "Sat, Dec 12, 2026 · 4:00 PM PHT",
    );
  });

  it("adds a same-day end time", () => {
    expect(
      formatEventWhen(new Date("2026-12-12T08:00:00Z"), new Date("2026-12-12T14:30:00Z")),
    ).toBe("Sat, Dec 12, 2026 · 4:00 PM – 10:30 PM PHT");
  });

  it("writes out an end on another day", () => {
    expect(
      formatEventWhen(new Date("2026-12-12T08:00:00Z"), new Date("2026-12-13T02:00:00Z")),
    ).toBe("Sat, Dec 12, 2026 · 4:00 PM – Sun, Dec 13, 2026 · 10:00 AM PHT");
  });

  it("uses the Philippine date when UTC is still the previous day", () => {
    expect(formatEventWhen(new Date("2026-12-31T23:00:00Z"), null)).toBe(
      "Fri, Jan 1, 2027 · 7:00 AM PHT",
    );
  });
});

describe("formatExpectedAttendees", () => {
  it.each([
    [0, "No expected headcount yet"],
    [1, "1 expected attendee"],
    [1800, "1,800 expected attendees"],
  ])("%i -> %s", (count, text) => {
    expect(formatExpectedAttendees(count)).toBe(text);
  });
});

describe("manilaDay", () => {
  it("rolls over at midnight Philippine time, which is 16:00 UTC", () => {
    expect(manilaDay(new Date("2026-10-11T15:59:59Z"))).toBe("2026-10-11");
    expect(manilaDay(new Date("2026-10-11T16:00:00Z"))).toBe("2026-10-12");
  });
});

describe("groupEvents", () => {
  // 2026-10-11 12:00 in Manila.
  const now = new Date("2026-10-11T04:00:00Z");

  it("keeps an event upcoming for the whole of its day, then moves it to past", () => {
    const earlierToday = item("EVT-2026-0001", "2026-10-11T00:00:00Z"); // 08:00 PHT today
    const yesterdayLate = item("EVT-2026-0002", "2026-10-10T15:00:00Z"); // 23:00 PHT yesterday
    const groups = groupEvents([earlierToday, yesterdayLate], now);
    expect(groups.upcoming.map((e) => e.reference)).toEqual(["EVT-2026-0001"]);
    expect(groups.past.map((e) => e.reference)).toEqual(["EVT-2026-0002"]);
  });

  it("uses the end time when there is one", () => {
    const overnight = item("EVT-2026-0003", "2026-10-10T12:00:00Z", "2026-10-11T02:00:00Z");
    expect(groupEvents([overnight], now).upcoming).toHaveLength(1);
  });

  it("orders upcoming soonest first and past most recent first", () => {
    const events = [
      item("EVT-2026-0010", "2026-12-12T08:00:00Z"),
      item("EVT-2026-0011", "2026-10-20T08:00:00Z"),
      item("EVT-2026-0012", "2026-01-05T08:00:00Z"),
      item("EVT-2026-0013", "2026-09-30T08:00:00Z"),
    ];
    const groups = groupEvents(events, now);
    expect(groups.upcoming.map((e) => e.reference)).toEqual(["EVT-2026-0011", "EVT-2026-0010"]);
    expect(groups.past.map((e) => e.reference)).toEqual(["EVT-2026-0013", "EVT-2026-0012"]);
  });

  it("breaks ties on the same start by reference", () => {
    const groups = groupEvents(
      [
        item("EVT-2026-0021", "2026-12-12T08:00:00Z"),
        item("EVT-2026-0020", "2026-12-12T08:00:00Z"),
      ],
      now,
    );
    expect(groups.upcoming.map((e) => e.reference)).toEqual(["EVT-2026-0020", "EVT-2026-0021"]);
  });

  it("returns two empty groups for no events", () => {
    expect(groupEvents([], now)).toEqual({ upcoming: [], past: [] });
  });
});