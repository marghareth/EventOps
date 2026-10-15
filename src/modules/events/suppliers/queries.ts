// src/modules/events/suppliers/queries.ts
// Supplier reads (B4-03, D-068). Every query filters by the event ID. These are not access checks:
// callers authorize first (read.ts does).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { toCalendarDate } from "./payment-due";
import type { SupplierInput } from "./schema";

/** One supplier as the list and its forms show it. Every member may see every field (D-068). */
export type SupplierRecord = SupplierInput & {
  id: string;
  number: number;
  /** Last saved change. Edits refuse stale saves with it (D-032). */
  updatedAt: Date;
};

export const SUPPLIER_SELECT = {
  id: true,
  number: true,
  name: true,
  category: true,
  categoryDetail: true,
  contactName: true,
  email: true,
  phone: true,
  notes: true,
  updatedAt: true,
} as const;

/** The event's suppliers, by name, then by number for equal names. */
export async function listSuppliers(db: PrismaClient, eventId: string): Promise<SupplierRecord[]> {
  return db.supplier.findMany({
    where: { eventId },
    select: SUPPLIER_SELECT,
    orderBy: [{ name: "asc" }, { number: "asc" }],
  });
}

/** One supplier, only if it belongs to this event. Null otherwise. */
export async function getSupplier(
  db: PrismaClient,
  eventId: string,
  supplierId: string,
): Promise<SupplierRecord | null> {
  return db.supplier.findFirst({ where: { id: supplierId, eventId }, select: SUPPLIER_SELECT });
}

/** What the supplier list needs about a supplier's quotes and payments (B4-16), as strings. */
export type SupplierMoneyRows = {
  quotes: { amount: string; status: "PENDING" | "ACCEPTED" | "DECLINED" }[];
  payments: { amount: string; status: "UNPAID" | "PAID"; dueDate: string }[];
};

/**
 * The event's suppliers with their quotes' and payments' amounts, statuses and due dates, in one
 * query (B4-16): by name, then number. Statuses are calculated from these rows by the caller.
 */
export async function listSuppliersWithMoney(
  db: PrismaClient,
  eventId: string,
): Promise<(SupplierRecord & SupplierMoneyRows)[]> {
  const rows = await db.supplier.findMany({
    where: { eventId },
    select: {
      ...SUPPLIER_SELECT,
      quotes: { select: { amount: true, status: true }, where: { eventId } },
      payments: { select: { amount: true, status: true, dueDate: true }, where: { eventId } },
    },
    orderBy: [{ name: "asc" }, { number: "asc" }],
  });
  return rows.map(({ quotes, payments, ...supplier }) => ({
    ...supplier,
    quotes: quotes.map((q) => ({ amount: q.amount.toFixed(2), status: q.status })),
    payments: payments.map((p) => ({
      amount: p.amount.toFixed(2),
      status: p.status,
      dueDate: toCalendarDate(p.dueDate),
    })),
  }));
}