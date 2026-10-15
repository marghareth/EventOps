// src/modules/events/suppliers/create-payment.ts
// Add-payment use case (B4-14, D-077). One transaction:
//   1. lock the supplier, found only inside this event, in the same statement that checks the
//      creator is a member whose role may manage suppliers (D-035, supplier-lock.ts),
//   2. take the event's next payment number,
//   3. insert the payment and record "payment.created" in the audit log (D-037).
// A refusal writes nothing. If anything fails, everything rolls back, including the number. The
// input must already be checked with paymentFormSchema for today in Manila; the database enforces
// the date range and the paid-date rule again. The caller must have authenticated the creator and
// authorized with authorizeEvent (D-036).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { formatPaymentReference, type PaymentInput } from "./payment-schema";
import { formatSupplierReference } from "./schema";
import { lockSupplierForUpdates } from "./supplier-lock";

export type CreatePaymentResult =
  | { ok: true; payment: { id: string; reference: string } }
  /** No such supplier in this event, or the creator may not manage it: nothing was saved. */
  | { ok: false; reason: "not-found" };

/** A calendar date ("2026-11-15") as the Date Prisma writes to a DATE column. */
export const toDateColumn = (value: string) => new Date(`${value}T00:00:00.000Z`);

export async function createPayment(
  db: PrismaClient,
  args: { eventId: string; supplierId: string; creatorId: string; payment: PaymentInput },
): Promise<CreatePaymentResult> {
  return db.$transaction(async (tx) => {
    const supplierNumber = await lockSupplierForUpdates(tx, {
      eventId: args.eventId,
      supplierId: args.supplierId,
      userId: args.creatorId,
    });
    if (supplierNumber === null) return { ok: false, reason: "not-found" } as const;

    // Raw SQL so the event's updatedAt (its edit version, D-032) does not move.
    const [counter] = await tx.$queryRaw<{ lastPaymentNumber: number }[]>`
      UPDATE events SET "lastPaymentNumber" = "lastPaymentNumber" + 1
      WHERE id = ${args.eventId}::uuid
      RETURNING "lastPaymentNumber"`;

    const { payment } = args;
    const created = await tx.supplierPayment.create({
      data: {
        eventId: args.eventId,
        supplierId: args.supplierId,
        number: counter.lastPaymentNumber,
        kind: payment.kind,
        description: payment.description,
        amount: payment.amount,
        dueDate: toDateColumn(payment.dueDate),
        status: payment.status,
        paidOn: payment.paidOn ? toDateColumn(payment.paidOn) : null,
      },
      select: { id: true },
    });
    const reference = formatPaymentReference(counter.lastPaymentNumber);
    await writeAudit(tx, {
      eventId: args.eventId,
      actorId: args.creatorId,
      action: "payment.created",
      entityId: created.id,
      details: {
        reference,
        supplierReference: formatSupplierReference(supplierNumber),
        ...payment,
      },
    });
    return { ok: true, payment: { id: created.id, reference } } as const;
  });
}