// src/modules/events/suppliers/payment-queries.ts
// Supplier payment reads (B4-14, D-077). Every query filters by the event ID. These are not access
// checks: callers authorize first (read.ts does). Amounts come back as Prisma Decimal values and
// dates as DATE values (midnight UTC of the day); both are turned into canonical strings here
// ("49500.00", "2026-11-15"), never JavaScript numbers or shifted times.
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { toCalendarDate } from "./payment-due";
import type { PaymentInput } from "./payment-schema";

/** One payment as the supplier page and the payment forms show it. Every member may see it. */
export type PaymentRecord = PaymentInput & {
  id: string;
  supplierId: string;
  number: number;
  createdAt: Date;
  /** Last saved change. Edits refuse stale saves with it (D-032). */
  updatedAt: Date;
};

const PAYMENT_SELECT = {
  id: true,
  supplierId: true,
  number: true,
  kind: true,
  description: true,
  amount: true,
  dueDate: true,
  status: true,
  paidOn: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PaymentRow = Omit<PaymentRecord, "amount" | "dueDate" | "paidOn"> & {
  amount: { toFixed(digits: number): string };
  dueDate: Date;
  paidOn: Date | null;
};

export function toPaymentRecord({ amount, dueDate, paidOn, ...row }: PaymentRow): PaymentRecord {
  return {
    ...row,
    amount: amount.toFixed(2),
    dueDate: toCalendarDate(dueDate),
    paidOn: paidOn ? toCalendarDate(paidOn) : null,
  };
}

/** A supplier's payments by due date, then number. Only payments of this event's supplier. */
export async function listSupplierPayments(
  db: PrismaClient,
  eventId: string,
  supplierId: string,
): Promise<PaymentRecord[]> {
  const rows = await db.supplierPayment.findMany({
    where: { eventId, supplierId },
    select: PAYMENT_SELECT,
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
  });
  return rows.map(toPaymentRecord);
}

/** One payment, only if it belongs to this supplier of this event. Null otherwise. */
export async function getPayment(
  db: PrismaClient,
  eventId: string,
  supplierId: string,
  paymentId: string,
): Promise<PaymentRecord | null> {
  const row = await db.supplierPayment.findFirst({
    where: { id: paymentId, eventId, supplierId },
    select: PAYMENT_SELECT,
  });
  return row ? toPaymentRecord(row) : null;
}