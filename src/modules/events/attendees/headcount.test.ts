// src/modules/events/attendees/headcount.test.ts
// The expected headcount rule (B2-05, D-046): Confirmed counts 1 + plus-ones; Pending and Maybe are
// "not yet confirmed"; Declined counts 0, plus-ones included.
import { describe, expect, it } from "vitest";
import { expectedHeadcount, type HeadcountInput } from "./headcount";
import { RSVP_STATUSES } from "./schema";

const a = (rsvpStatus: HeadcountInput["rsvpStatus"], plusOnes = 0): HeadcountInput => ({
  rsvpStatus,
  plusOnes,
});

describe("expectedHeadcount", () => {
  it("is all zeros for an empty guest list", () => {
    expect(expectedHeadcount([])).toEqual({
      total: 0,
      confirmedAttendees: 0,
      confirmedPlusOnes: 0,
      notYetConfirmed: { attendees: 0, people: 0 },
      declinedAttendees: 0,
    });
  });

  it("counts a confirmed attendee with no plus-one as 1", () => {
    expect(expectedHeadcount([a("CONFIRMED")]).total).toBe(1);
  });

  it("counts a confirmed attendee as 1 + their plus-ones, up to the maximum of 10", () => {
    expect(expectedHeadcount([a("CONFIRMED", 1)]).total).toBe(2);
    expect(expectedHeadcount([a("CONFIRMED", 10)]).total).toBe(11);
  });

  it("matches the documented example: 8 confirmed bringing 4 plus-ones is 12", () => {
    const list = [
      ...Array.from({ length: 6 }, () => a("CONFIRMED")),
      a("CONFIRMED", 1),
      a("CONFIRMED", 3),
    ];
    expect(expectedHeadcount(list)).toMatchObject({
      total: 12,
      confirmedAttendees: 8,
      confirmedPlusOnes: 4,
    });
  });

  it.each(["PENDING", "MAYBE"] as const)(
    "does not count %s, and shows them as not yet confirmed with their plus-ones",
    (status) => {
      expect(expectedHeadcount([a(status, 2)])).toMatchObject({
        total: 0,
        notYetConfirmed: { attendees: 1, people: 3 },
      });
    },
  );

  it("counts Declined as 0, plus-ones included", () => {
    expect(expectedHeadcount([a("DECLINED", 3)])).toMatchObject({
      total: 0,
      confirmedPlusOnes: 0,
      notYetConfirmed: { attendees: 0, people: 0 },
      declinedAttendees: 1,
    });
  });

  it("adds up a mixed list", () => {
    expect(
      expectedHeadcount([
        a("CONFIRMED", 2),
        a("CONFIRMED"),
        a("PENDING", 1),
        a("MAYBE"),
        a("DECLINED", 4),
      ]),
    ).toEqual({
      total: 4,
      confirmedAttendees: 2,
      confirmedPlusOnes: 2,
      notYetConfirmed: { attendees: 2, people: 3 },
      declinedAttendees: 1,
    });
  });

  it("has a rule for every RSVP status, so none is silently dropped", () => {
    for (const status of RSVP_STATUSES) {
      expect(() => expectedHeadcount([a(status)])).not.toThrow();
    }
  });

  it("removing a plus-one (setting it to 0) lowers the total by one", () => {
    expect(
      expectedHeadcount([a("CONFIRMED", 1)]).total - expectedHeadcount([a("CONFIRMED", 0)]).total,
    ).toBe(1);
  });
});