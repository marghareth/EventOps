// src/modules/events/attendees/read.ts
// The event's guest list for pages and route handlers (B2-01). Authorizes itself with event.view,
// so every member can read it and no one else can (D-035, D-036). Dietary needs only for roles with
// attendees.dietary (B2-06, D-047).
import "server-only";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import { z } from "zod";
import {
  authorizeEvent,
  can,
  sampleGetAttendee,
  sampleListAttendees,
  type EventAuthorization,
} from "@/modules/events/public";
import {
  getAttendee,
  listGuestList,
  toGuestListRow,
  type AttendeeRecord,
  type GuestListRow,
} from "./queries";

export type EventAttendees =
  | {
      ok: true;
      attendees: GuestListRow[];
      /** Whether the reader may see dietary needs (attendees.dietary, D-047). */
      showDietaryNeeds: boolean;
    }
  | { ok: false; reason: Extract<EventAuthorization, { ok: false }>["reason"] };

export async function getEventAttendees(eventId: string): Promise<EventAttendees> {
  const auth = await authorizeEvent(
    eventId,
    "event.view",
    `/events/${encodeURIComponent(eventId)}/attendees`,
  );
  if (!auth.ok) return { ok: false, reason: auth.reason };
  // B2-06, D-047: dietary needs are loaded only for roles that may see them, so they never reach a
  // page that must not show them. Contact details and notes are not loaded for the list at all.
  const showDietaryNeeds = can(auth.event.role, "attendees.dietary");
  const attendees = isSampleDataMode()
    ? sampleListAttendees(auth.event.id).map((a) => toGuestListRow(a, showDietaryNeeds)) // D-041
    : await listGuestList(getDb(), auth.event.id, { dietaryNeeds: showDietaryNeeds });
  return { ok: true, attendees, showDietaryNeeds };
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