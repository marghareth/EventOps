// src/modules/events/health/queries.ts
// Event Health reads for the Overview dashboard and the Health page (B8-F11 to B8-F17; D-105 to
// D-107). Every member sees health (event.view); recent activity only for roles with audit.view
// (Owner, Coordinator), as the permission matrix says (D-035). Nothing is stored.
import "server-only";
import { describeAuditEntry, formatAuditTime } from "@/modules/events/audit/public";
import { authorizeEvent, can, getEventActivity } from "@/modules/events/public";
import { buildHealthOverview, type HealthOverview } from "./application/get-health-report";
import { healthStateReader } from "./infrastructure/health-state-reader";

/** How many recent Activity entries the dashboard shows (B8-F13, D-107). */
const RECENT_ACTIVITY = 5;

export type RecentActivity =
  | { status: "hidden" }
  | { status: "unavailable" }
  | {
      status: "ok";
      entries: { id: string; summary: string; who: string; when: string }[];
    };

export type EventHealth =
  | { ok: true; health: HealthOverview; activity: RecentActivity }
  | { ok: false; reason: "not-found" | "forbidden" | "unavailable" };

async function recentActivity(eventId: string): Promise<RecentActivity> {
  try {
    const activity = await getEventActivity(eventId);
    if (!activity.ok) return { status: "hidden" };
    return {
      status: "ok",
      entries: activity.entries.slice(0, RECENT_ACTIVITY).map((entry) => ({
        id: entry.id,
        summary: describeAuditEntry(entry).summary,
        who: entry.actorName ?? "A former member",
        when: formatAuditTime(entry.createdAt),
      })),
    };
  } catch {
    return { status: "unavailable" };
  }
}

/** The event's health, and recent activity when the reader may see it. */
export async function getEventHealth(
  eventId: string,
  options: { withActivity: boolean },
): Promise<EventHealth> {
  const auth = await authorizeEvent(
    eventId,
    "event.view",
    `/events/${encodeURIComponent(eventId)}`,
  );
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const event = {
    id: auth.event.id,
    expectedAttendees: auth.event.expectedAttendees,
    capacity: auth.event.capacity,
  };
  const [health, activity] = await Promise.all([
    buildHealthOverview(healthStateReader, event),
    options.withActivity && can(auth.event.role, "audit.view")
      ? recentActivity(event.id)
      : Promise.resolve<RecentActivity>({ status: "hidden" }),
  ]);
  if (!health) return { ok: false, reason: "unavailable" };
  return { ok: true, health, activity };
}