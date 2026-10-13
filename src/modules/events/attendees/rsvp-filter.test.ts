// src/modules/events/attendees/rsvp-filter.test.ts
// RSVP filter (B2-08, D-049): the address value maps only to a defined state, counts cover every
// state, and filtering keeps the list's order.
import { describe, expect, it } from "vitest";
import {
  RSVP_FILTER_ORDER,
  filterByRsvp,
  parseRsvpFilter,
  rsvpCounts,
  rsvpFilterParam,
} from "./rsvp-filter";
import { RSVP_STATUSES } from "./schema";

const list = [
  { name: "Ana", rsvpStatus: "CONFIRMED" },
  { name: "Ben", rsvpStatus: "PENDING" },
  { name: "Carla", rsvpStatus: "CONFIRMED" },
  { name: "Diego", rsvpStatus: "MAYBE" },
] as const;

describe("RSVP filter values", () => {
  it("shows every defined state exactly once", () => {
    expect([...RSVP_FILTER_ORDER].sort()).toEqual([...RSVP_STATUSES].sort());
  });

  it.each([
    ["confirmed", "CONFIRMED"],
    ["pending", "PENDING"],
    ["maybe", "MAYBE"],
    ["declined", "DECLINED"],
  ] as const)("reads %j as %s, and writes it back the same way", (value, status) => {
    expect(parseRsvpFilter(value)).toBe(status);
    expect(rsvpFilterParam(status)).toBe(value);
  });

  it.each([undefined, "", "CONFIRMED", "Confirmed", "attending", "confirmed ", "' OR 1=1 --"])(
    "ignores %j",
    (value) => {
      expect(parseRsvpFilter(value)).toBeNull();
    },
  );

  it("uses the first value when the address repeats it", () => {
    expect(parseRsvpFilter(["maybe", "declined"])).toBe("MAYBE");
  });
});

describe("rsvpCounts", () => {
  it("counts every state, including the ones nobody is in", () => {
    expect(rsvpCounts(list)).toEqual({ PENDING: 1, CONFIRMED: 2, DECLINED: 0, MAYBE: 1 });
    expect(rsvpCounts([])).toEqual({ PENDING: 0, CONFIRMED: 0, DECLINED: 0, MAYBE: 0 });
  });
});

describe("filterByRsvp", () => {
  it("keeps only that state, in the same order", () => {
    expect(filterByRsvp(list, "CONFIRMED").map((a) => a.name)).toEqual(["Ana", "Carla"]);
    expect(filterByRsvp(list, "DECLINED")).toEqual([]);
  });

  it("returns everyone, as a copy, without a filter", () => {
    const all = filterByRsvp(list, null);
    expect(all).toEqual(list);
    expect(all).not.toBe(list);
  });
});