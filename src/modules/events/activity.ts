// src/modules/events/activity.ts
// The event's activity (audit log), for members allowed to see it (B1-11; audit.view is Owner and
// Coordinator, D-035). Authorizes itself through authorizeEvent (D-036), so the log can't be read
// without the check.
import "server-only";
import { getDb } from "@/lib/db";
import { listAuditEntries, type AuditEntryView } from "@/modules/events/audit/public";
import { authorizeEvent, type EventAuthorization } from "./authorize";

export type EventActivity =
  | { ok: true; entries: AuditEntryView[] }
  | { ok: false; reason: Extract<EventAuthorization, { ok: false }>["reason"] };

export async function getEventActivity(eventId: string): Promise<EventActivity> {
  const auth = await authorizeEvent(
    eventId,
    "audit.view",
    `/events/${encodeURIComponent(eventId)}/activity`,
  );
  if (!auth.ok) return { ok: false, reason: auth.reason };
  return { ok: true, entries: await listAuditEntries(getDb(), auth.event.id) };
}