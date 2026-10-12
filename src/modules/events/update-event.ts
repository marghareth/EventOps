// src/modules/events/update-event.ts
// Edit-event use case (B1-05). Changes only the editable details: never the reference, status,
// creator or members, and records the change in the audit log in the same transaction (B1-11). One
// conditional UPDATE does three checks at once (D-032):
//   - the event exists,
//   - the editor is a member whose role may edit it (D-031), checked again in the database,
//   - nobody else saved since the editor loaded it (updatedAt still equals `version`).
// The caller must have authenticated the editor.
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "./permissions";
import { eventChanges, type NewEvent } from "./schema";

const DETAIL_FIELDS = {
  name: true,
  venue: true,
  description: true,
  startsAt: true,
  endsAt: true,
  capacity: true,
  expectedAttendees: true,
} as const;

export type UpdateEventResult =
  | { ok: true }
  /** Someone saved after `version`: nothing was changed. */
  | { ok: false; reason: "stale" }
  /** No such event, or the editor may not edit it: nothing was changed. */
  | { ok: false; reason: "not-found" };

export async function updateEvent(
  db: PrismaClient,
  args: { eventId: string; editorId: string; version: Date; details: NewEvent },
): Promise<UpdateEventResult> {
  const allowed = {
    members: { some: { userId: args.editorId, role: { in: [...rolesAllowed("event.edit")] } } },
  };
  const where = { id: args.eventId, updatedAt: args.version, ...allowed };

  return db.$transaction(async (tx) => {
    const before = await tx.event.findFirst({ where, select: DETAIL_FIELDS });
    // The conditional update repeats every check, so a change in between updates nothing.
    const { count } = before
      ? await tx.event.updateMany({ where, data: args.details })
      : { count: 0 };
    if (!before || count !== 1) {
      const stillEditable = await tx.event.count({ where: { id: args.eventId, ...allowed } });
      return { ok: false, reason: stillEditable ? "stale" : "not-found" } as const;
    }

    const changes = eventChanges(before, args.details);
    if (Object.keys(changes).length > 0) {
      // Same transaction: if the entry cannot be written, the edit is rolled back (D-037).
      await writeAudit(tx, {
        eventId: args.eventId,
        actorId: args.editorId,
        action: "event.updated",
        entityId: args.eventId,
        details: { changes },
      });
    }
    return { ok: true } as const;
  });
}