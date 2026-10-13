// src/modules/events/attendees/read.ts
// The event's guest list for pages and route handlers (B2-01). Authorizes itself with event.view,
// so every member can read it and no one else can (D-035, D-036).
import "server-only";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import { z } from "zod";
import {
  authorizeEvent,
  sampleGetAttendee,
  sampleListAttendees,
  type EventAuthorization,
} from "@/modules/events/public";
import { getAttendee, listAttendees, type AttendeeRecord } from "./queries";

export type EventAttendees =
  | { ok: true; attendees: AttendeeRecord[] }
  | { ok: false; reason: Extract<EventAuthorization, { ok: false }>["reason"] };

export async function getEventAttendees(eventId: string): Promise<EventAttendees> {
  const auth = await authorizeEvent(
    eventId,
    "event.view",
    `/events/${encodeURIComponent(eventId)}/attendees`,
  );
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const attendees = isSampleDataMode()
    ? sampleListAttendees(auth.event.id) // Dev-only sample data (D-041).
    : await listAttendees(getDb(), auth.event.id);
  return { ok: true, attendees };
}

export type AttendeeForEditing =
  | { ok: true; attendee: AttendeeRecord }
  /** not-found: unknown attendee, another event's attendee or a malformed ID (indistinguishable). */
  | { ok: false; reason: Extract<EventAuthorization, { ok: false }>["reason"] };

/**
 * One attendee for the edit form (B2-03). Authorizes itself with attendees.manage, and finds the
 * attendee only inside the authorized event.
 */
export async function getAttendeeForEditing(
  eventId: string,
  attendeeId: string,
): Promise<AttendeeForEditing> {
  const auth = await authorizeEvent(
    eventId,
    "attendees.manage",
    `/events/${encodeURIComponent(eventId)}/attendees`,
  );
  if (!auth.ok) return { ok: false, reason: auth.reason };
  if (!z.uuid().safeParse(attendeeId).success) return { ok: false, reason: "not-found" };
  const attendee = isSampleDataMode()
    ? sampleGetAttendee(auth.event.id, attendeeId) // Dev-only sample data (D-041).
    : await getAttendee(getDb(), auth.event.id, attendeeId);
  return attendee ? { ok: true, attendee } : { ok: false, reason: "not-found" };
}