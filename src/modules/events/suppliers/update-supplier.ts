// src/modules/events/suppliers/update-supplier.ts
// Edit-supplier use case (B4-04, D-071). Like editing an attendee (D-032), one conditional UPDATE
// checks at once that:
//   - the supplier exists in this event (another event's supplier is "not found"),
//   - the editor is a member whose role may manage suppliers (D-035), checked in the database,
//   - nobody else saved the supplier since the editor loaded it (updatedAt equals `version`).
// Only the editable fields are written; the event and number never change. The change is recorded
// in the audit log in the same transaction (D-037). The caller must have authenticated the editor
// and authorized with authorizeEvent (D-036).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import { SUPPLIER_SELECT } from "./queries";
import { formatSupplierReference, supplierChanges, type SupplierInput } from "./schema";

export type UpdateSupplierResult =
  | { ok: true }
  /** Someone saved after `version`: nothing was changed. */
  | { ok: false; reason: "stale" }
  /** No such supplier in this event, or the editor may not edit it: nothing was changed. */
  | { ok: false; reason: "not-found" };

export async function updateSupplier(
  db: PrismaClient,
  args: {
    eventId: string;
    supplierId: string;
    editorId: string;
    version: Date;
    details: SupplierInput;
  },
): Promise<UpdateSupplierResult> {
  const allowed = {
    eventId: args.eventId,
    event: {
      members: {
        some: { userId: args.editorId, role: { in: [...rolesAllowed("suppliers.manage")] } },
      },
    },
  };
  const where = { id: args.supplierId, updatedAt: args.version, ...allowed };
  // An explicit list of editable fields: nothing else from the input can reach the row.
  const data = {
    name: args.details.name,
    category: args.details.category,
    categoryDetail: args.details.categoryDetail,
    contactName: args.details.contactName,
    email: args.details.email,
    phone: args.details.phone,
    notes: args.details.notes,
  };

  return db.$transaction(async (tx) => {
    const before = await tx.supplier.findFirst({ where, select: SUPPLIER_SELECT });
    // The conditional update repeats every check, so a change in between updates nothing.
    const { count } = before ? await tx.supplier.updateMany({ where, data }) : { count: 0 };
    if (!before || count !== 1) {
      const stillEditable = await tx.supplier.count({ where: { id: args.supplierId, ...allowed } });
      return { ok: false, reason: stillEditable ? "stale" : "not-found" } as const;
    }

    const changes = supplierChanges(before, data);
    if (Object.keys(changes).length > 0) {
      await writeAudit(tx, {
        eventId: args.eventId,
        actorId: args.editorId,
        action: "supplier.updated",
        entityId: args.supplierId,
        details: { reference: formatSupplierReference(before.number), changes },
      });
    }
    return { ok: true } as const;
  });
}