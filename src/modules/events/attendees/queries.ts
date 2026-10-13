// src/modules/events/attendees/queries.ts
// Attendee reads (B2-01). Every query filters by the event ID. These are not access checks: callers
// authorize first (getEventAttendees below does, with event.view, D-035).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AttendeeInput } from "./schema";

/** The stored fields an attendee form edits. */
export const ATTENDEE_SELECT = {
  number: true,
  name: true,
  email: true,
  phone: true,
  category: true,
  rsvpStatus: true,
  plusOnes: true,
  dietaryNeeds: true,
  notes: true,
} as const;

/** One attendee as the guest list and its forms show it. */
export type AttendeeRecord = AttendeeInput & {
  id: string;
  number: number;
  /** Last saved change. Edits refuse stale saves with it (D-032, D-042). */
  updatedAt: Date;
};

const RECORD_SELECT = { id: true, updatedAt: true, ...ATTENDEE_SELECT } as const;

/** The event's attendees, by name, then by number for equal names. */
export async function listAttendees(db: PrismaClient, eventId: string): Promise<AttendeeRecord[]> {
  return db.attendee.findMany({
    where: { eventId },
    select: RECORD_SELECT,
    orderBy: [{ name: "asc" }, { number: "asc" }],
  });
}

/**
 * One guest-list row (B2-06, D-047): only what the list shows. Contact details and notes are never
 * loaded for it. dietaryNeeds is present only when the reader may see it.
 */
export type GuestListRow = Pick<
  AttendeeRecord,
  "id" | "number" | "name" | "rsvpStatus" | "plusOnes" | "category"
> & { dietaryNeeds?: string | null };

const GUEST_LIST_SELECT = {
  id: true,
  number: true,
  name: true,
  rsvpStatus: true,
  plusOnes: true,
  category: true,
} as const;

/** The guest list, in the same order as listAttendees. */
export async function listGuestList(
  db: PrismaClient,
  eventId: string,
  options: { dietaryNeeds: boolean },
): Promise<GuestListRow[]> {
  const order = [{ name: "asc" as const }, { number: "asc" as const }];
  return options.dietaryNeeds
    ? db.attendee.findMany({
        where: { eventId },
        select: { ...GUEST_LIST_SELECT, dietaryNeeds: true },
        orderBy: order,
      })
    : db.attendee.findMany({ where: { eventId }, select: GUEST_LIST_SELECT, orderBy: order });
}

/** A full record cut down to a guest-list row, for sample data (D-041). */
export function toGuestListRow(record: AttendeeRecord, dietaryNeeds: boolean): GuestListRow {
  const { id, number, name, rsvpStatus, plusOnes, category } = record;
  const row: GuestListRow = { id, number, name, rsvpStatus, plusOnes, category };
  if (dietaryNeeds) row.dietaryNeeds = record.dietaryNeeds;
  return row;
}

/**
 * One attendee for the details page (B2-07, D-048). Dietary needs only with attendees.dietary;
 * email, phone and notes only with attendees.private. Fields a reader may not see are absent.
 */
export type AttendeeDetails = GuestListRow & {
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export type AttendeeDetailsFields = { dietaryNeeds: boolean; private: boolean };

function detailsSelect(fields: AttendeeDetailsFields) {
  return {
    ...GUEST_LIST_SELECT,
    ...(fields.dietaryNeeds ? { dietaryNeeds: true } : {}),
    ...(fields.private ? { email: true, phone: true, notes: true } : {}),
  } as const;
}

/** One attendee's details, only if it belongs to this event. Null otherwise. */
export async function getAttendeeDetails(
  db: PrismaClient,
  eventId: string,
  attendeeId: string,
  fields: AttendeeDetailsFields,
): Promise<AttendeeDetails | null> {
  return db.attendee.findFirst({
    where: { id: attendeeId, eventId },
    select: detailsSelect(fields),
  }) as Promise<AttendeeDetails | null>;
}

/** A full record cut down to what the reader may see, for sample data (D-041). */
export function toAttendeeDetails(
  record: AttendeeRecord,
  fields: AttendeeDetailsFields,
): AttendeeDetails {
  const details: AttendeeDetails = toGuestListRow(record, fields.dietaryNeeds);
  if (fields.private) {
    details.email = record.email;
    details.phone = record.phone;
    details.notes = record.notes;
  }
  return details;
}

/** One attendee, only if it belongs to this event. Null otherwise, also for another event's ID. */
export async function getAttendee(
  db: PrismaClient,
  eventId: string,
  attendeeId: string,
): Promise<AttendeeRecord | null> {
  return db.attendee.findFirst({ where: { id: attendeeId, eventId }, select: RECORD_SELECT });
}