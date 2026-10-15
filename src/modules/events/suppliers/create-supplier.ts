// src/modules/events/suppliers/create-supplier.ts
// Add-supplier use case (B4-03, D-070). One transaction:
//   1. take the event's next supplier number; the same statement checks that the creator is a
//      member whose role may manage suppliers (D-035), so a refused user changes nothing,
//   2. insert the supplier,
//   3. record "supplier.created" in the audit log (D-037), without contact details or notes.
// If anything fails, everything rolls back, including the number. The caller must have
// authenticated the creator and authorized with authorizeEvent (D-036).
import "server-only";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import { formatSupplierReference, type SupplierInput } from "./schema";

export type CreateSupplierResult =
  | { ok: true; supplier: { id: string; reference: string } }
  /** No such event, or the creator may not manage its suppliers: nothing was saved. */
  | { ok: false };

export async function createSupplier(
  db: PrismaClient,
  args: { eventId: string; creatorId: string; supplier: SupplierInput },
): Promise<CreateSupplierResult> {
  const roles = [...rolesAllowed("suppliers.manage")] as MemberRole[];

  return db.$transaction(async (tx) => {
    // Raw SQL so the event's updatedAt (its edit version, D-032) does not move. The row stays
    // locked until commit, so concurrent additions get distinct numbers.
    const [counter] = await tx.$queryRaw<{ lastSupplierNumber: number }[]>`
      UPDATE events SET "lastSupplierNumber" = "lastSupplierNumber" + 1
      WHERE id = ${args.eventId}::uuid
        AND EXISTS (
          SELECT 1 FROM event_members m
          WHERE m."eventId" = events.id AND m."userId" = ${args.creatorId}::uuid
            AND m.role = ANY(${roles}::member_role[])
        )
      RETURNING "lastSupplierNumber"`;
    if (!counter) return { ok: false } as const;

    const created = await tx.supplier.create({
      data: { ...args.supplier, eventId: args.eventId, number: counter.lastSupplierNumber },
      select: { id: true, number: true, name: true, category: true, categoryDetail: true },
    });
    const reference = formatSupplierReference(created.number);
    await writeAudit(tx, {
      eventId: args.eventId,
      actorId: args.creatorId,
      action: "supplier.created",
      entityId: created.id,
      details: {
        reference,
        name: created.name,
        category: created.category,
        categoryDetail: created.categoryDetail,
      },
    });
    return { ok: true, supplier: { id: created.id, reference } } as const;
  });
}