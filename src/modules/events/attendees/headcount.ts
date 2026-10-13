// src/modules/events/attendees/headcount.ts
// The expected headcount from the guest list (B2-05, D-046). The one place the plus-one rule lives;
// every screen uses this instead of counting on its own. Pure: no database, no clock.
//
//   CONFIRMED          → counts 1 + plus-ones
//   PENDING or MAYBE   → not yet confirmed: shown separately, counts 0
//   DECLINED           → counts 0, plus-ones included
//
// This is not the event's planning number (events.expectedAttendees) and not live attendance.
import type { RsvpStatus } from "./schema";

export type HeadcountInput = { rsvpStatus: RsvpStatus; plusOnes: number };

export type ExpectedHeadcount = {
  /** Confirmed attendees plus their plus-ones. */
  total: number;
  /** Confirmed attendees (people on the list). */
  confirmedAttendees: number;
  /** Plus-ones of confirmed attendees. */
  confirmedPlusOnes: number;
  /** Pending and Maybe: how many attendees, and how many people with their plus-ones. */
  notYetConfirmed: { attendees: number; people: number };
  /** Declined attendees. Their plus-ones are not counted anywhere. */
  declinedAttendees: number;
};

export function expectedHeadcount(attendees: readonly HeadcountInput[]): ExpectedHeadcount {
  const result: ExpectedHeadcount = {
    total: 0,
    confirmedAttendees: 0,
    confirmedPlusOnes: 0,
    notYetConfirmed: { attendees: 0, people: 0 },
    declinedAttendees: 0,
  };
  for (const { rsvpStatus, plusOnes } of attendees) {
    switch (rsvpStatus) {
      case "CONFIRMED":
        result.confirmedAttendees += 1;
        result.confirmedPlusOnes += plusOnes;
        break;
      case "PENDING":
      case "MAYBE":
        result.notYetConfirmed.attendees += 1;
        result.notYetConfirmed.people += 1 + plusOnes;
        break;
      case "DECLINED":
        result.declinedAttendees += 1;
        break;
      default: {
        // A new RSVP value must get a rule here before it can be stored (D-046).
        const unknown: never = rsvpStatus;
        throw new Error(`No headcount rule for RSVP status ${String(unknown)}`);
      }
    }
  }
  result.total = result.confirmedAttendees + result.confirmedPlusOnes;
  return result;
}