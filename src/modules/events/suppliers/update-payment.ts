// src/modules/events/suppliers/update-payment.ts
// Edit-payment use case (B4-14, D-077). One transaction:
//   1. lock the payment's supplier, found only inside this event, with the editor's role checked in
//      the same statement (D-035, supplier-lock.ts),
//   2. find the payment, only if it belongs to this supplier of this event,
//   3. refuse a stale save: the payment changed since the editor loaded it (D-032),
//   4. write the editable fields (the supplier, event and number never change) and record
//      "payment.updated" with what changed (D-037).
// A save that changes nothing writes nothing. The input must already be checked with
// paymentFormSchema for today in Manila. The caller must have authenticated the editor and
// authorized with authorizeEvent (D-036).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { toDateColumn } from "./create-payment";
import { toPaymentRecord } from "./payment-queries";
import { formatPaymentReference, paymentChanges, type PaymentInput } from "./payment-schema";
import { formatSupplierReference } from "./schema";
import { lockSupplierForUpdates } from "./supplier-lock";

export type UpdatePaymentResult =
  /** Saved, or nothing to save (`changed: false`, nothing written). */
  | { ok: true; changed: boolean; reference: string }
  /** No such payment for this supplier of this event, or the editor may not edit it. */
  | { ok: false; reason: "not-found" }
  /** Someone saved the payment after `version`: nothing was changed. */
  | { ok: false; reason: "stale" };

export async function updatePayment(
  db: PrismaClient,
  args: {
    eventId: string;
    supplierId: string;
    paymentId: string;
    editorId: string;
    version: Date;
    payment: PaymentInput;
  },
): Promise<UpdatePaymentResult> {
  return db.$transaction(async (tx) => {
    const supplierNumber = await lockSupplierForUpdates(tx, {
      eventId: args.eventId,
      supplierId: args.supplierId,
      userId: args.editorId,
    });
    if (supplierNumber === null) return { ok: false, reason: "not-found" } as const;

    const row = await tx.supplierPayment.findFirst({
      where: { id: args.paymentId, eventId: args.eventId, supplierId: args.supplierId },
    });
    if (!row) return { ok: false, reason: "not-found" } as const;
    if (row.updatedAt.getTime() !== args.version.getTime()) {
      return { ok: false, reason: "stale" } as const;
    }
    const current = toPaymentRecord(row);
    const reference = formatPaymentReference(current.number);
    const changes = paymentChanges(current, args.payment);
    if (Object.keys(changes).length === 0) return { ok: true, changed: false, reference } as const;

    const { payment } = args;
    await tx.supplierPayment.update({
      where: { id: args.paymentId },
      data: {
        kind: payment.kind,
        description: payment.description,
        amount: payment.amount,
        dueDate: toDateColumn(payment.dueDate),
        status: payment.status,
        paidOn: payment.paidOn ? toDateColumn(payment.paidOn) : null,
      },
    });
    await writeAudit(tx, {
      eventId: args.eventId,
      actorId: args.editorId,
      action: "payment.updated",
      entityId: args.paymentId,
      details: { reference, supplierReference: formatSupplierReference(supplierNumber), changes },
    });
    return { ok: true, changed: true, reference } as const;
  });
}