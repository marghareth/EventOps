// src/modules/events/schema.ts
// Validation for event input (B1-02). The form sends strings; this turns them into a checked event.
// Limits match the database (D-010, D-023) so the form explains a problem before Postgres rejects it.
// Dates and times are entered in Philippine time (Asia/Manila, UTC+8, no daylight saving) and
// stored in UTC (D-025).
import { z } from "zod";
import type { EventChanges } from "@/modules/events/audit/public";

export const EVENT_LIMITS = {
  name: 120,
  venue: 200,
  description: 5000,
  /** Upper bound for capacity and expected attendees; keeps values far inside Postgres integer range. */
  headcount: 1_000_000,
} as const;

/** Philippine time offset. Asia/Manila has no daylight saving time. */
const MANILA_OFFSET = "+08:00";

/** Characters as Postgres counts them (code points), so emoji count once, like varchar(n). */
function charCount(value: string): number {
  return Array.from(value).length;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True for a real calendar date such as 2026-12-12 (rejects 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** "2026-12-12" + "16:00" in Philippine time, as a UTC instant. */
export function manilaDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${MANILA_OFFSET}`);
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) => charCount(value) <= max,
      `${label} can be at most ${max.toLocaleString("en-US")} characters.`,
    )
    .transform((value) => (value === "" ? null : value));

const optionalWholeNumber = (min: number, message: string) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), message)
    .transform((value) => (value === "" ? null : Number(value)))
    .refine(
      (value) => value === null || (value >= min && value <= EVENT_LIMITS.headcount),
      `${message.replace(/\.$/, "")}, up to ${EVENT_LIMITS.headcount.toLocaleString("en-US")}.`,
    );

/** What the Create Event form sends. Every value is a string; empty optional fields are "". */
export const createEventFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Enter the event name.", abort: true })
      .refine(
        (value) => charCount(value) <= EVENT_LIMITS.name,
        `Use ${EVENT_LIMITS.name} characters or fewer.`,
      ),
    date: z
      .string()
      .trim()
      .min(1, { message: "Enter the event date.", abort: true })
      .refine(isCalendarDate, "Enter a valid date."),
    startTime: z
      .string()
      .trim()
      .min(1, { message: "Enter the start time.", abort: true })
      .regex(TIME_PATTERN, "Enter a valid time, for example 16:00."),
    endTime: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || TIME_PATTERN.test(value),
        "Enter a valid time, for example 22:00.",
      ),
    venue: optionalText(EVENT_LIMITS.venue, "Venue"),
    description: optionalText(EVENT_LIMITS.description, "Description"),
    capacity: optionalWholeNumber(1, "Enter a whole number of 1 or more."),
    expectedAttendees: optionalWholeNumber(0, "Enter a whole number of 0 or more."),
  })
  // The end is on the same day as the start (multi-day events belong to the event editing task).
  .refine((input) => input.endTime === "" || input.endTime >= input.startTime, {
    path: ["endTime"],
    message: "End time can't be before the start time.",
  });

export type CreateEventForm = z.input<typeof createEventFormSchema>;

/** The checked values the create-event use case stores. */
export type NewEvent = {
  name: string;
  venue: string | null;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  capacity: number | null;
  expectedAttendees: number;
};

export function toNewEvent(form: z.output<typeof createEventFormSchema>): NewEvent {
  return {
    name: form.name,
    venue: form.venue,
    description: form.description,
    startsAt: manilaDateTime(form.date, form.startTime),
    endsAt: form.endTime ? manilaDateTime(form.date, form.endTime) : null,
    capacity: form.capacity,
    expectedAttendees: form.expectedAttendees ?? 0,
  };
}

/** The UTC instant as Philippine date "YYYY-MM-DD" and time "HH:MM". */
function manilaParts(instant: Date): { date: string; time: string } {
  const iso = new Date(instant.getTime() + 8 * 60 * 60 * 1000).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/**
 * A stored event as Edit Event form values (B1-05): the reverse of toNewEvent. Times come back in
 * Philippine time; empty optional values become "".
 */
export function toEventFormValues(event: NewEvent): Required<CreateEventForm> {
  const start = manilaParts(event.startsAt);
  return {
    name: event.name,
    date: start.date,
    startTime: start.time,
    endTime: event.endsAt ? manilaParts(event.endsAt).time : "",
    venue: event.venue ?? "",
    description: event.description ?? "",
    capacity: event.capacity === null ? "" : String(event.capacity),
    expectedAttendees: String(event.expectedAttendees),
  };
}

/** True when saving `next` would change nothing about `current`. */
export function sameEventDetails(current: NewEvent, next: NewEvent): boolean {
  return (
    current.name === next.name &&
    current.venue === next.venue &&
    current.description === next.description &&
    current.startsAt.getTime() === next.startsAt.getTime() &&
    (current.endsAt?.getTime() ?? null) === (next.endsAt?.getTime() ?? null) &&
    current.capacity === next.capacity &&
    current.expectedAttendees === next.expectedAttendees
  );
}

/**
 * What changed between two versions of an event, as recorded in the audit log (B1-11, D-037).
 * Dates become ISO strings; the free-text description is marked changed, never copied.
 */
export function eventChanges(before: NewEvent, after: NewEvent): EventChanges {
  const changes: EventChanges = {};
  const iso = (date: Date | null) => (date ? date.toISOString() : null);
  if (before.name !== after.name) changes.name = { from: before.name, to: after.name };
  if (before.venue !== after.venue) changes.venue = { from: before.venue, to: after.venue };
  if (before.description !== after.description) changes.description = { changed: true };
  if (before.startsAt.getTime() !== after.startsAt.getTime()) {
    changes.startsAt = { from: before.startsAt.toISOString(), to: after.startsAt.toISOString() };
  }
  if (iso(before.endsAt) !== iso(after.endsAt)) {
    changes.endsAt = { from: iso(before.endsAt), to: iso(after.endsAt) };
  }
  if (before.capacity !== after.capacity) {
    changes.capacity = { from: before.capacity, to: after.capacity };
  }
  if (before.expectedAttendees !== after.expectedAttendees) {
    changes.expectedAttendees = { from: before.expectedAttendees, to: after.expectedAttendees };
  }
  return changes;
}