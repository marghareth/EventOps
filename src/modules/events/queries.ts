// src/modules/events/queries.ts
// Event reads. Membership is the only way an event is returned: every query filters by the
// signed-in user's event_members row (PROJECT_RULES section 7). The user ID must come from the
// server session, never from the request.
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { isDemoWithoutDatabase } from "@/lib/demo-auth";
import type { EventListItem } from "./list";

/** Events the user is a member of, with the user's role in each. Order is decided by groupEvents. */
export async function listEventsForUser(
  db: PrismaClient,
  userId: string,
): Promise<EventListItem[]> {
  const rows = await db.event.findMany({
    where: { members: { some: { userId } } },
    select: {
      id: true,
      reference: true,
      name: true,
      venue: true,
      startsAt: true,
      endsAt: true,
      status: true,
      expectedAttendees: true,
      members: { where: { userId }, select: { role: true } },
    },
    orderBy: [{ startsAt: "asc" }, { reference: "asc" }],
  });
  return rows.map(({ members, ...event }) => ({ ...event, role: members[0].role }));
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