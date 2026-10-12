// src/modules/events/create-event.ts
// Create-event use case (B1-02). One transaction:
//   1. take the next EVT-<year>-<number> from event_reference_counters (D-005),
//   2. insert the event,
//   3. insert the creator's OWNER membership (required by the D-022 trigger),
//   4. record "event.created" in the audit log (B1-11, D-037).
// If anything fails, everything rolls back, including the reference number, so numbers have no
// gaps. The caller must have authenticated the creator; this function does not check access.
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { formatEventReference, manilaYear } from "./reference";
import type { NewEvent } from "./schema";

export type CreatedEvent = { id: string; reference: string };

export async function createEvent(
  db: PrismaClient,
  args: { event: NewEvent; creatorId: string; now: Date },
): Promise<CreatedEvent> {
  const year = manilaYear(args.now);

  return db.$transaction(async (tx) => {
    // Atomic: concurrent creations get distinct numbers; the row stays locked until commit.
    const [counter] = await tx.$queryRaw<{ lastNumber: number }[]>`
      INSERT INTO event_reference_counters (year, "lastNumber", "updatedAt")
      VALUES (${year}, 1, now())
      ON CONFLICT (year) DO UPDATE
        SET "lastNumber" = event_reference_counters."lastNumber" + 1, "updatedAt" = now()
      RETURNING "lastNumber"`;

    const created = await tx.event.create({
      data: {
        ...args.event,
        reference: formatEventReference(year, counter.lastNumber),
        createdById: args.creatorId,
        members: { create: { userId: args.creatorId, role: "OWNER" } },
      },
      select: { id: true, reference: true },
    });
    await writeAudit(tx, {
      eventId: created.id,
      actorId: args.creatorId,
      action: "event.created",
      entityId: created.id,
      details: { reference: created.reference, name: args.event.name },
    });
    return created;
  });
}