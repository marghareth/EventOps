// src/modules/events/attendees/delete-attendee.ts
// Remove-attendee use case (B2-01, D-042). Permanently deletes one attendee of one event; the
// audit entry keeps who it was (reference and name). The same statement checks that the user is a
// member whose role may manage attendees (D-035). The caller must have authenticated the user and
// authorized with authorizeEvent (D-036).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import { formatAttendeeReference } from "./schema";

export type DeleteAttendeeResult =
  /** Removed. `reference` is the removed attendee's readable ID, for the confirmation. */
  | { ok: true; reference: string }
  /** No such attendee in this event, or the user may not remove it: nothing was removed. */
  | { ok: false };

export async function deleteAttendee(
  db: PrismaClient,
  args: { eventId: string; attendeeId: string; userId: string },
): Promise<DeleteAttendeeResult> {
  const where = {
    id: args.attendeeId,
    eventId: args.eventId,
    event: {
      members: {
        some: { userId: args.userId, role: { in: [...rolesAllowed("attendees.manage")] } },
      },
    },
  };

  return db.$transaction(async (tx) => {
    const attendee = await tx.attendee.findFirst({ where, select: { number: true, name: true } });
    const { count } = attendee ? await tx.attendee.deleteMany({ where }) : { count: 0 };
    if (!attendee || count !== 1) return { ok: false } as const;
    const reference = formatAttendeeReference(attendee.number);
    await writeAudit(tx, {
      eventId: args.eventId,
      actorId: args.userId,
      action: "attendee.deleted",
      entityId: args.attendeeId,
      details: { reference, name: attendee.name },
    });
    return { ok: true, reference } as const;
  });
}