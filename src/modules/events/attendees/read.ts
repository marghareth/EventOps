// src/modules/events/attendees/read.ts
// The event's guest list for pages and route handlers (B2-01). Authorizes itself with event.view,
// so every member can read it and no one else can (D-035, D-036).
import "server-only";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import { authorizeEvent, type EventAuthorization } from "@/modules/events/public";
import { listAttendees, type AttendeeRecord } from "./queries";

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
  // Dev-only sample data (D-041) has no attendees yet.
  if (isSampleDataMode()) return { ok: true, attendees: [] };
  return { ok: true, attendees: await listAttendees(getDb(), auth.event.id) };
}