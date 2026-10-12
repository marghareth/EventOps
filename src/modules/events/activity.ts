// src/modules/events/activity.ts
// The event's activity (audit log), for members allowed to see it (B1-11; audit.view is Owner and
// Coordinator, D-035). Authorizes itself through authorizeEvent (D-036), so the log can't be read
// without the check.
import "server-only";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import { listAuditEntries, type AuditEntryView } from "@/modules/events/audit/public";
import { authorizeEvent, type EventAuthorization } from "./authorize";
import { sampleListAuditEntries } from "./sample-data";

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
  const entries = isSampleDataMode()
    ? sampleListAuditEntries(auth.event.id)
    : await listAuditEntries(getDb(), auth.event.id);
  return { ok: true, entries };
}