// src/modules/events/suppliers/delete-supplier.ts
// Remove-supplier use case (B4-05, D-072). Permanently deletes one supplier of one event; the audit
// entry keeps which supplier it was (readable ID and name). The same statement checks that the user
// is a member whose role may manage suppliers (D-035). The caller must have authenticated the user
// and authorized with authorizeEvent (D-036).
//
// Related records (D-072, D-003, D-002): no table links to suppliers yet. When supplier payments,
// budget lines and tasks arrive, their tasks add these steps to this same transaction, before the
// delete: copy the supplier's committed and paid totals onto its budget line and unlink it; clear
// task links. Payment rows are deleted with the supplier by their foreign key (cascade).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import { formatSupplierReference } from "./schema";

export type DeleteSupplierResult =
  /** Removed. `reference` is the removed supplier's readable ID, for the confirmation. */
  | { ok: true; reference: string }
  /** No such supplier in this event, or the user may not remove it: nothing was removed. */
  | { ok: false };

export async function deleteSupplier(
  db: PrismaClient,
  args: { eventId: string; supplierId: string; userId: string },
): Promise<DeleteSupplierResult> {
  const where = {
    id: args.supplierId,
    eventId: args.eventId,
    event: {
      members: {
        some: { userId: args.userId, role: { in: [...rolesAllowed("suppliers.manage")] } },
      },
    },
  };

  return db.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({ where, select: { number: true, name: true } });
    const { count } = supplier ? await tx.supplier.deleteMany({ where }) : { count: 0 };
    if (!supplier || count !== 1) return { ok: false } as const;
    const reference = formatSupplierReference(supplier.number);
    await writeAudit(tx, {
      eventId: args.eventId,
      actorId: args.userId,
      action: "supplier.deleted",
      entityId: args.supplierId,
      details: { reference, name: supplier.name },
    });
    return { ok: true, reference } as const;
  });
}