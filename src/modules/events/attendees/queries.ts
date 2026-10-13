// src/modules/events/attendees/queries.ts
// Attendee reads (B2-01). Every query filters by the event ID. These are not access checks: callers
// authorize first (getEventAttendees below does, with event.view, D-035).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { formatAttendeeReference, type AttendeeInput } from "./schema";

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
 * One guest-list row (B2-06, D-047; B2-10, D-050): what the list shows and searches. dietaryNeeds is
 * present only for roles with attendees.dietary; email and phone only for roles with
 * attendees.private, which may search by them (they are not shown in the list). Notes are never
 * loaded for the list.
 */
export type GuestListRow = Pick<
  AttendeeRecord,
  "id" | "number" | "name" | "rsvpStatus" | "plusOnes" | "category"
> & { dietaryNeeds?: string | null; email?: string | null; phone?: string | null };

/** Which optional fields the reader may receive. */
export type GuestListFields = { dietaryNeeds: boolean; contact: boolean };

const GUEST_LIST_SELECT = {
  id: true,
  number: true,
  name: true,
  rsvpStatus: true,
  plusOnes: true,
  category: true,
} as const;

/** The guest list, by name then number. Search, filters and sorting run on it afterwards (D-050). */
export async function listGuestList(
  db: PrismaClient,
  eventId: string,
  fields: GuestListFields,
): Promise<GuestListRow[]> {
  return db.attendee.findMany({
    where: { eventId },
    select: {
      ...GUEST_LIST_SELECT,
      ...(fields.dietaryNeeds ? { dietaryNeeds: true } : {}),
      ...(fields.contact ? { email: true, phone: true } : {}),
    },
    orderBy: [{ name: "asc" }, { number: "asc" }],
  }) as Promise<GuestListRow[]>;
}

/** A full record cut down to a guest-list row, for sample data (D-041). */
export function toGuestListRow(record: AttendeeRecord, fields: GuestListFields): GuestListRow {
  const { id, number, name, rsvpStatus, plusOnes, category } = record;
  const row: GuestListRow = { id, number, name, rsvpStatus, plusOnes, category };
  if (fields.dietaryNeeds) row.dietaryNeeds = record.dietaryNeeds;
  if (fields.contact) {
    row.email = record.email;
    row.phone = record.phone;
  }
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
  const details: AttendeeDetails = toGuestListRow(record, {
    dietaryNeeds: fields.dietaryNeeds,
    contact: false,
  });
  if (fields.private) {
    details.email = record.email;
    details.phone = record.phone;
    details.notes = record.notes;
  }
  return details;
}

/** Names, emails and IDs of the event's attendees, for import duplicate checks (B2-17, D-052). */
export async function listAttendeeIdentities(
  db: PrismaClient,
  eventId: string,
): Promise<{ name: string; email: string | null; reference: string }[]> {
  const rows = await db.attendee.findMany({
    where: { eventId },
    select: { name: true, email: true, number: true },
    orderBy: { number: "asc" },
  });
  return rows.map((r) => ({
    name: r.name,
    email: r.email,
    reference: formatAttendeeReference(r.number),
  }));
}

/** One attendee, only if it belongs to this event. Null otherwise, also for another event's ID. */
export async function getAttendee(
  db: PrismaClient,
  eventId: string,
  attendeeId: string,
): Promise<AttendeeRecord | null> {
  return db.attendee.findFirst({ where: { id: attendeeId, eventId }, select: RECORD_SELECT });
}