// src/modules/events/attendees/create-attendee.ts
// Add-attendee use case (B2-01, D-042). One transaction:
//   1. take the event's next attendee number; the same statement checks that the creator is a
//      member whose role may manage attendees (D-035), so a refused user changes nothing,
//   2. insert the attendee,
//   3. record "attendee.created" in the audit log (D-037).
// If anything fails, everything rolls back, including the number. The caller must have
// authenticated the creator and authorized with authorizeEvent (D-036).
import "server-only";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import { formatAttendeeReference, type AttendeeInput } from "./schema";

export type CreatedAttendee = { id: string; reference: string };

export type CreateAttendeeResult =
  | { ok: true; attendee: CreatedAttendee }
  /** No such event, or the creator may not manage its attendees: nothing was saved. */
  | { ok: false };

export async function createAttendee(
  db: PrismaClient,
  args: { eventId: string; creatorId: string; attendee: AttendeeInput },
): Promise<CreateAttendeeResult> {
  const roles = [...rolesAllowed("attendees.manage")] as MemberRole[];

  return db.$transaction(async (tx) => {
    // Raw SQL so the event's updatedAt (its edit version, D-032) does not move. The row stays
    // locked until commit, so concurrent additions get distinct numbers.
    const [counter] = await tx.$queryRaw<{ lastAttendeeNumber: number }[]>`
      UPDATE events SET "lastAttendeeNumber" = "lastAttendeeNumber" + 1
      WHERE id = ${args.eventId}::uuid
        AND EXISTS (
          SELECT 1 FROM event_members m
          WHERE m."eventId" = events.id AND m."userId" = ${args.creatorId}::uuid
            AND m.role = ANY(${roles}::member_role[])
        )
      RETURNING "lastAttendeeNumber"`;
    if (!counter) return { ok: false } as const;

    const created = await tx.attendee.create({
      data: { ...args.attendee, eventId: args.eventId, number: counter.lastAttendeeNumber },
      select: { id: true, number: true, name: true },
    });
    const reference = formatAttendeeReference(created.number);
    await writeAudit(tx, {
      eventId: args.eventId,
      actorId: args.creatorId,
      action: "attendee.created",
      entityId: created.id,
      details: { reference, name: created.name },
    });
    return { ok: true, attendee: { id: created.id, reference } } as const;
  });
}