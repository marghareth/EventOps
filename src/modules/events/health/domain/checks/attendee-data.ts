// src/modules/events/health/domain/checks/attendee-data.ts
// Attendee data health (B8-F02; D-105, checks A1 to A5). Pure.
//   A1 guest list has guests           none → Not checked
//   A2 every guest has replied         Pending or Maybe → Needs attention
//   A3 every guest has email or phone  missing → Needs attention
//   A4 confirmed headcount ≤ capacity  over → Critical (no capacity → Not checked)
//   A5 confirmed headcount ≤ expected  over → Needs attention
// A2 to A5 are Not checked while the guest list is empty. Headcount is the attendees' own rule (D-046).
import type { HealthCheckResult } from "../health-check";
import { count, nameList } from "../health-check";
import type { HealthState } from "../health-state";

const fix = { target: "attendees", label: "Open Attendees" } as const;

export function attendeeChecks(state: HealthState): HealthCheckResult[] {
  const guests = state.attendees;
  const none = guests.length === 0;
  const notChecked = (id: string, label: string, summary: string): HealthCheckResult => ({
    id,
    area: "ATTENDEES",
    label,
    outcome: "NOT_CHECKED",
    summary,
    reason: "There are no guests on the list yet, so this can't be checked.",
    references: [],
    fix: { target: "attendees", label: "Add guests" },
  });

  const results: HealthCheckResult[] = [];

  results.push(
    none
      ? {
          ...notChecked("attendees.list", "The guest list has guests", "No guests yet"),
          reason:
            "The guest list is empty. Add guests or import a spreadsheet to check their readiness.",
        }
      : {
          id: "attendees.list",
          area: "ATTENDEES",
          label: "The guest list has guests",
          outcome: "PASSED",
          summary: `${count(guests.length, "guest", "guests")} on the list`,
          reason: `The guest list holds ${count(guests.length, "guest", "guests")}.`,
          references: [],
          fix: null,
        },
  );

  if (none) {
    results.push(
      notChecked("attendees.rsvp", "Every guest has replied", "No guests yet"),
      notChecked("attendees.contact", "Every guest has an email or phone", "No guests yet"),
      notChecked("attendees.capacity", "Confirmed guests fit the venue", "No guests yet"),
      notChecked(
        "attendees.planning",
        "Confirmed guests fit the expected attendance",
        "No guests yet",
      ),
    );
    return results;
  }

  const waiting = guests.filter((g) => g.rsvpStatus === "PENDING" || g.rsvpStatus === "MAYBE");
  results.push(
    waiting.length > 0
      ? {
          id: "attendees.rsvp",
          area: "ATTENDEES",
          label: "Every guest has replied",
          outcome: "NEEDS_ATTENTION",
          summary: `${count(waiting.length, "guest hasn't", "guests haven't")} replied yet`,
          reason: `RSVP is Pending or Maybe for ${nameList(waiting)}. They aren't counted in the confirmed headcount until they confirm.`,
          references: waiting.map((g) => g.reference),
          fix,
        }
      : {
          id: "attendees.rsvp",
          area: "ATTENDEES",
          label: "Every guest has replied",
          outcome: "PASSED",
          summary: "Every guest has replied",
          reason: "No guest's RSVP is Pending or Maybe.",
          references: [],
          fix: null,
        },
  );

  const unreachable = guests.filter((g) => !g.hasContact);
  results.push(
    unreachable.length > 0
      ? {
          id: "attendees.contact",
          area: "ATTENDEES",
          label: "Every guest has an email or phone",
          outcome: "NEEDS_ATTENTION",
          summary: `${count(unreachable.length, "guest has", "guests have")} no email or phone`,
          reason: `No email or phone is recorded for ${nameList(unreachable)}, so they can't be reached with updates.`,
          references: unreachable.map((g) => g.reference),
          fix,
        }
      : {
          id: "attendees.contact",
          area: "ATTENDEES",
          label: "Every guest has an email or phone",
          outcome: "PASSED",
          summary: "Every guest can be reached",
          reason: "Every guest has an email or a phone recorded.",
          references: [],
          fix: null,
        },
  );

  const headcount = state.confirmedHeadcount;
  const people = count(headcount, "confirmed person", "confirmed people");
  if (state.capacity === null) {
    results.push({
      id: "attendees.capacity",
      area: "ATTENDEES",
      label: "Confirmed guests fit the venue",
      outcome: "NOT_CHECKED",
      summary: "No venue capacity set",
      reason:
        "The event has no venue capacity, so the confirmed headcount can't be compared with it.",
      references: [],
      fix: { target: "settings", label: "Set the venue capacity" },
    });
  } else {
    const over = headcount - state.capacity;
    results.push(
      over > 0
        ? {
            id: "attendees.capacity",
            area: "ATTENDEES",
            label: "Confirmed guests fit the venue",
            outcome: "CRITICAL",
            summary: `${count(over, "person", "people")} more than the venue holds`,
            reason: `${people} (confirmed guests and their plus-ones) against a venue capacity of ${state.capacity.toLocaleString("en-US")}.`,
            references: [],
            fix: { target: "settings", label: "Review the venue capacity" },
          }
        : {
            id: "attendees.capacity",
            area: "ATTENDEES",
            label: "Confirmed guests fit the venue",
            outcome: "PASSED",
            summary: `${people} within a capacity of ${state.capacity.toLocaleString("en-US")}`,
            reason: `${people} (confirmed guests and their plus-ones) fit the venue capacity of ${state.capacity.toLocaleString("en-US")}.`,
            references: [],
            fix: null,
          },
    );
  }

  const planned = state.expectedAttendees;
  const above = headcount - planned;
  results.push(
    above > 0
      ? {
          id: "attendees.planning",
          area: "ATTENDEES",
          label: "Confirmed guests fit the expected attendance",
          outcome: "NEEDS_ATTENTION",
          summary: `${count(above, "person", "people")} more than expected`,
          reason: `${people} (confirmed guests and their plus-ones) against an expected attendance of ${planned.toLocaleString("en-US")}. Update the expected attendees, or check the impact first.`,
          references: [],
          fix: { target: "settings", label: "Review the expected attendees" },
        }
      : {
          id: "attendees.planning",
          area: "ATTENDEES",
          label: "Confirmed guests fit the expected attendance",
          outcome: "PASSED",
          summary: `${people} of ${planned.toLocaleString("en-US")} expected`,
          reason: `${people} (confirmed guests and their plus-ones) are within the expected attendance of ${planned.toLocaleString("en-US")}.`,
          references: [],
          fix: null,
        },
  );
  return results;
}