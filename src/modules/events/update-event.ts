// src/modules/events/update-event.ts
// Edit-event use case (B1-05). Changes only the editable details: never the reference, status,
// creator or members. One conditional UPDATE does three checks at once (D-032):
//   - the event exists,
//   - the editor is a member whose role may edit it (D-031), checked again in the database,
//   - nobody else saved since the editor loaded it (updatedAt still equals `version`).
// The caller must have authenticated the editor.
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { rolesAllowed } from "./permissions";
import type { NewEvent } from "./schema";

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

  const { count } = await db.event.updateMany({
    where: { id: args.eventId, updatedAt: args.version, ...allowed },
    data: args.details,
  });
  // Audit (B1-05): record the change here once the audit log exists. The criterion applies "once
  // that system is available"; see BUILD_BACKLOG.md and D-032.
  if (count === 1) return { ok: true };

  const stillEditable = await db.event.count({ where: { id: args.eventId, ...allowed } });
  return { ok: false, reason: stillEditable ? "stale" : "not-found" };
}