// src/modules/events/suppliers/supplier-overview.ts
// What the supplier list shows about a supplier's money (B4-16, D-081): its Accepted quote, how many
// quotes are pending, its payment status (D-078) and its next unpaid due date with the overdue
// count (D-079). Built from stored rows with the same rules as the supplier's page; nothing new is
// calculated here. Pure: today is passed in.
import { supplierDueSummary, type SupplierDueSummary } from "./payment-due";
import { supplierPaymentSummary, type SupplierPaymentStatus } from "./payment-status";
import type { SupplierMoneyRows } from "./queries";

export type SupplierOverview = {
  /** The Accepted quote's amount, or null. */
  acceptedQuote: string | null;
  /** Quotes still Pending. */
  pendingQuotes: number;
  paymentStatus: SupplierPaymentStatus;
  due: SupplierDueSummary;
};

export function supplierOverview(rows: SupplierMoneyRows, today: string): SupplierOverview {
  const accepted = rows.quotes.find((quote) => quote.status === "ACCEPTED");
  return {
    acceptedQuote: accepted?.amount ?? null,
    pendingQuotes: rows.quotes.filter((quote) => quote.status === "PENDING").length,
    paymentStatus: supplierPaymentSummary({
      acceptedAmount: accepted?.amount ?? null,
      payments: rows.payments,
    }).status,
    due: supplierDueSummary(rows.payments, today),
  };
}