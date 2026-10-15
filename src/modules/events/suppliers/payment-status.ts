// src/modules/events/suppliers/payment-status.ts
// A supplier's payment status (B4-13, D-078): how much has been paid against what is committed.
// Deterministic domain rule, never AI. Committed is the amount of the supplier's Accepted quote
// (D-003, D-075); paid is the sum of its payments recorded as Paid (D-077). Sums and comparisons
// use whole centavos (BigInt), never floating point. Overdue is a separate flag from the due rules
// (D-079), because a partly paid supplier can also be overdue. Pure: no database, no clock, safe
// for client components.
import { fromCentavos, toCentavos } from "./money";

/** The canonical supplier payment statuses, in display order. */
export const SUPPLIER_PAYMENT_STATUSES = [
  "NO_ACCEPTED_QUOTE",
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
] as const;
export type SupplierPaymentStatus = (typeof SUPPLIER_PAYMENT_STATUSES)[number];

type Definition = { label: string; description: string };

export const SUPPLIER_PAYMENT_STATUS_DEFINITIONS: Record<SupplierPaymentStatus, Definition> = {
  NO_ACCEPTED_QUOTE: {
    label: "No accepted quote",
    description: "No quote is accepted yet, so the amount owed isn't known.",
  },
  UNPAID: { label: "Unpaid", description: "Nothing has been paid yet." },
  PARTIALLY_PAID: {
    label: "Partially paid",
    description: "Some of the accepted quote has been paid.",
  },
  PAID: { label: "Paid", description: "The accepted quote has been paid in full." },
};

/** What the rule reads from one payment: its amount and whether it is recorded as paid. */
export type PaymentForStatus = { amount: string; status: "UNPAID" | "PAID" };

export type SupplierPaymentSummary = {
  status: SupplierPaymentStatus;
  /** The Accepted quote's amount, or null when no quote is accepted. Canonical string. */
  committed: string | null;
  /** The sum of payments recorded as Paid. Canonical string; "0.00" when none. */
  paid: string;
  /** How much more than the Accepted quote has been paid, or null when not more. */
  overpaidBy: string | null;
};

/**
 * The status (D-078):
 * - No accepted quote: no quote is Accepted, whatever has been paid (the amount owed is unknown).
 * - Unpaid: a quote is Accepted and nothing has been paid.
 * - Partially paid: more than nothing and less than the Accepted quote has been paid.
 * - Paid: at least the Accepted quote has been paid. Paying more is still Paid, with `overpaidBy`.
 */
export function supplierPaymentSummary(input: {
  acceptedAmount: string | null;
  payments: readonly PaymentForStatus[];
}): SupplierPaymentSummary {
  const paid = input.payments
    .filter((payment) => payment.status === "PAID")
    .reduce((sum, payment) => sum + toCentavos(payment.amount), BigInt(0));
  const summary = { paid: fromCentavos(paid), overpaidBy: null };
  if (input.acceptedAmount === null) {
    return { ...summary, status: "NO_ACCEPTED_QUOTE", committed: null };
  }
  const committed = toCentavos(input.acceptedAmount);
  const status: SupplierPaymentStatus =
    paid === BigInt(0) ? "UNPAID" : paid < committed ? "PARTIALLY_PAID" : "PAID";
  return {
    ...summary,
    status,
    committed: input.acceptedAmount,
    overpaidBy: paid > committed ? fromCentavos(paid - committed) : null,
  };
}