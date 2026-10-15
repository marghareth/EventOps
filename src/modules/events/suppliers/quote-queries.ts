// src/modules/events/suppliers/quote-queries.ts
// Quote reads (B4-09, D-075). Every query filters by the event ID. These are not access checks:
// callers authorize first (read.ts does). Amounts come back from the database as Prisma Decimal
// values and are turned into canonical strings here ("120000.50"), never JavaScript numbers.
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { QuoteInput } from "./quote-schema";

/** One quote as the supplier page and the quote forms show it. Every member may see it (D-075). */
export type QuoteRecord = QuoteInput & {
  id: string;
  supplierId: string;
  number: number;
  /** When the status last changed. */
  statusChangedAt: Date;
  createdAt: Date;
  /** Last saved change. Edits refuse stale saves with it (D-032). */
  updatedAt: Date;
};

const QUOTE_SELECT = {
  id: true,
  supplierId: true,
  number: true,
  description: true,
  amount: true,
  status: true,
  statusChangedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type QuoteRow = Omit<QuoteRecord, "amount"> & { amount: { toFixed(digits: number): string } };

function toRecord({ amount, ...row }: QuoteRow): QuoteRecord {
  return { ...row, amount: amount.toFixed(2) };
}

/** A supplier's quotes, oldest first (by number). Only quotes of this event's supplier. */
export async function listSupplierQuotes(
  db: PrismaClient,
  eventId: string,
  supplierId: string,
): Promise<QuoteRecord[]> {
  const rows = await db.supplierQuote.findMany({
    where: { eventId, supplierId },
    select: QUOTE_SELECT,
    orderBy: { number: "asc" },
  });
  return rows.map(toRecord);
}

/** One quote, only if it belongs to this supplier of this event. Null otherwise. */
export async function getQuote(
  db: PrismaClient,
  eventId: string,
  supplierId: string,
  quoteId: string,
): Promise<QuoteRecord | null> {
  const row = await db.supplierQuote.findFirst({
    where: { id: quoteId, eventId, supplierId },
    select: QUOTE_SELECT,
  });
  return row ? toRecord(row) : null;
}