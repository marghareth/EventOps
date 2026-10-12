// src/modules/events/delete-event.ts
// Delete-event use case (B1-06). Permanently deletes the event; the database removes everything
// that belongs to it with the event (foreign keys ON DELETE CASCADE, D-004). One DELETE checks, in
// the same statement, that the user is a member whose role may delete it (D-033). The caller must
// have authenticated the user.
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { rolesAllowed } from "./permissions";

export type DeleteEventResult =
  | { ok: true }
  /** No such event, or the user may not delete it: nothing was removed. */
  | { ok: false };

export async function deleteEvent(
  db: PrismaClient,
  args: { eventId: string; userId: string },
): Promise<DeleteEventResult> {
  const roles = [...rolesAllowed("event.delete")];
  const { count } = await db.event.deleteMany({
    where: { id: args.eventId, members: { some: { userId: args.userId, role: { in: roles } } } },
  });
  return count === 1 ? { ok: true } : { ok: false };
}