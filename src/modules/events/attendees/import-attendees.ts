// src/modules/events/attendees/import-attendees.ts
// Import use case (B2-18, D-052). One transaction for the whole import:
//   1. take the next N attendee numbers in one statement; the same statement checks that the
//      importer is a member whose role may import (import.run, D-035), so a refused user changes
//      nothing,
//   2. insert every attendee,
//   3. record one "attendees.imported" entry (counts and ID range only).
// If anything fails, nothing is saved and no number is used: all or none. The caller authorizes
// first and passes only rows that passed the import rules on the server.
import "server-only";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import { formatAttendeeReference, type AttendeeInput } from "./schema";

export type ImportResult =
  | { ok: true; count: number; first: string; last: string }
  /** No such event, the importer may not import, or nothing to import: nothing was saved. */
  | { ok: false };

export async function importAttendees(
  db: PrismaClient,
  args: { eventId: string; importerId: string; attendees: AttendeeInput[]; skipped: number },
): Promise<ImportResult> {
  const count = args.attendees.length;
  if (count === 0) return { ok: false };
  const roles = [...rolesAllowed("import.run")] as MemberRole[];

  return db.$transaction(
    async (tx) => {
      // Raw SQL so the event's updatedAt (its edit version, D-032) does not move. The row stays
      // locked until commit, so a concurrent addition or import gets numbers after these.
      const [counter] = await tx.$queryRaw<{ lastAttendeeNumber: number }[]>`
        UPDATE events SET "lastAttendeeNumber" = "lastAttendeeNumber" + ${count}
        WHERE id = ${args.eventId}::uuid
          AND EXISTS (
            SELECT 1 FROM event_members m
            WHERE m."eventId" = events.id AND m."userId" = ${args.importerId}::uuid
              AND m.role = ANY(${roles}::member_role[])
          )
        RETURNING "lastAttendeeNumber"`;
      if (!counter) return { ok: false } as const;

      const firstNumber = counter.lastAttendeeNumber - count + 1;
      await tx.attendee.createMany({
        data: args.attendees.map((attendee, i) => ({
          ...attendee,
          eventId: args.eventId,
          number: firstNumber + i,
        })),
      });
      const first = formatAttendeeReference(firstNumber);
      const last = formatAttendeeReference(counter.lastAttendeeNumber);
      await writeAudit(tx, {
        eventId: args.eventId,
        actorId: args.importerId,
        action: "attendees.imported",
        entityId: args.eventId,
        details: { count, first, last, skipped: args.skipped },
      });
      return { ok: true, count, first, last } as const;
    },
    { timeout: 20_000 },
  );
}