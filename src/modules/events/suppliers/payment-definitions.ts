// src/modules/events/suppliers/payment-definitions.ts
// The canonical payment kinds and recorded statuses (B4-12, B4-14; D-077). The form, server
// validation, the audit registry's copy and the database enums (`payment_kind`,
// `payment_record_status`) all follow these lists; tests keep them equal. Pure: safe for client
// components.

/** What a payment is for. Order is the order shown in the form. */
export const PAYMENT_KINDS = ["DEPOSIT", "PAYMENT"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_KIND_DEFINITIONS: Record<PaymentKind, { label: string; description: string }> =
  {
    DEPOSIT: { label: "Deposit", description: "Secures the booking, usually paid first." },
    PAYMENT: { label: "Payment", description: "A balance or an instalment." },
  };

/** What is recorded about a payment. Due and overdue are calculated (D-079). */
export const PAYMENT_RECORD_STATUSES = ["UNPAID", "PAID"] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export const PAYMENT_RECORD_STATUS_DEFINITIONS: Record<
  PaymentRecordStatus,
  { label: string; description: string }
> = {
  UNPAID: { label: "Not paid yet", description: "Still owed to the supplier." },
  PAID: { label: "Paid", description: "Paid to the supplier. Enter the day it was paid." },
};