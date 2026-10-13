// src/modules/events/attendees/update-attendee.ts
// Edit-attendee use case (B2-01, D-042). Like editing an event (D-032), one conditional UPDATE
// checks at once that:
//   - the attendee exists in this event,
//   - the editor is a member whose role may manage attendees (D-035), checked in the database,
//   - nobody else saved the attendee since the editor loaded it (updatedAt equals `version`).
// The change is recorded in the audit log in the same transaction (D-037). The caller must have
// authenticated the editor and authorized with authorizeEvent (D-036).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import { ATTENDEE_SELECT } from "./queries";
import { attendeeChanges, formatAttendeeReference, type AttendeeInput } from "./schema";

export type UpdateAttendeeResult =
  | { ok: true }
  /** Someone saved after `version`: nothing was changed. */
  | { ok: false; reason: "stale" }
  /** No such attendee in this event, or the editor may not edit it: nothing was changed. */
  | { ok: false; reason: "not-found" };

export async function updateAttendee(
  db: PrismaClient,
  args: {
    eventId: string;
    attendeeId: string;
    editorId: string;
    version: Date;
    details: AttendeeInput;
  },
): Promise<UpdateAttendeeResult> {
  const allowed = {
    eventId: args.eventId,
    event: {
      members: {
        some: { userId: args.editorId, role: { in: [...rolesAllowed("attendees.manage")] } },
      },
    },
  };
  const where = { id: args.attendeeId, updatedAt: args.version, ...allowed };

  return db.$transaction(async (tx) => {
    const before = await tx.attendee.findFirst({ where, select: ATTENDEE_SELECT });
    // The conditional update repeats every check, so a change in between updates nothing.
    const { count } = before
      ? await tx.attendee.updateMany({ where, data: args.details })
      : { count: 0 };
    if (!before || count !== 1) {
      const stillEditable = await tx.attendee.count({ where: { id: args.attendeeId, ...allowed } });
      return { ok: false, reason: stillEditable ? "stale" : "not-found" } as const;
    }

    const changes = attendeeChanges(before, args.details);
    if (Object.keys(changes).length > 0) {
      await writeAudit(tx, {
        eventId: args.eventId,
        actorId: args.editorId,
        action: "attendee.updated",
        entityId: args.attendeeId,
        details: { reference: formatAttendeeReference(before.number), changes },
      });
    }
    return { ok: true } as const;
  });
}