// src/modules/events/queries.ts
// Event reads. Membership is the only way an event is returned: every query filters by the
// signed-in user's event_members row (PROJECT_RULES section 7). The user ID must come from the
// server session, never from the request.
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { isDemoWithoutDatabase } from "@/lib/demo-auth";
import type { EventDetails, EventListItem } from "./list";

const LIST_FIELDS = {
  id: true,
  reference: true,
  name: true,
  venue: true,
  startsAt: true,
  endsAt: true,
  status: true,
  expectedAttendees: true,
} as const;

/** Events the user is a member of, with the user's role in each. Order is decided by groupEvents. */
export async function listEventsForUser(
  db: PrismaClient,
  userId: string,
): Promise<EventListItem[]> {
  const rows = await db.event.findMany({
    where: { members: { some: { userId } } },
    select: { ...LIST_FIELDS, members: { where: { userId }, select: { role: true } } },
    orderBy: [{ startsAt: "asc" }, { reference: "asc" }],
  });
  return rows.map(({ members, ...event }) => ({ ...event, role: members[0].role }));
}

/**
 * One event, only if the user is a member of it (B1-04). Returns null both for an unknown event and
 * for another user's event, so callers cannot tell them apart (D-027).
 */
export async function getEventForMember(
  db: PrismaClient,
  eventId: string,
  userId: string,
): Promise<EventDetails | null> {
  const row = await db.event.findFirst({
    where: { id: eventId, members: { some: { userId } } },
    select: {
      ...LIST_FIELDS,
      description: true,
      capacity: true,
      updatedAt: true,
      members: { where: { userId }, select: { role: true } },
    },
  });
  if (!row) return null;
  const { members, ...event } = row;
  return { ...event, role: members[0].role };
}

export type MyEventsResult =
  | { status: "ok"; events: EventListItem[] }
  /** Demo sign-in with no database (D-024): there is nothing to read. */
  | { status: "no-database" };

/** "My events" for the page and GET /api/events. Database errors are thrown to the caller. */
export async function getMyEvents(userId: string): Promise<MyEventsResult> {
  if (isDemoWithoutDatabase()) return { status: "no-database" };
  return { status: "ok", events: await listEventsForUser(getDb(), userId) };
}