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

/** One attendee, only if it belongs to this event. Null otherwise, also for another event's ID. */
export async function getAttendee(
  db: PrismaClient,
  eventId: string,
  attendeeId: string,
): Promise<AttendeeRecord | null> {
  return db.attendee.findFirst({ where: { id: attendeeId, eventId }, select: RECORD_SELECT });
}