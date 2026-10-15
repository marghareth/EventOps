// src/modules/events/suppliers/payment-due.ts
// Due and overdue rules for supplier payments (B4-15, D-079). Deterministic, never AI. Dates are
// calendar dates in Philippine time (Asia/Manila, UTC+8, no daylight saving; D-025), written as
// "YYYY-MM-DD" strings, so comparing two of them as text compares the days. "Today" is passed in:
// the server works it out once per request with manilaToday(new Date()), so the rules never read a
// clock and tests can fix the day. Pure: safe for client components.

/** The supported range for due and paid dates (D-077), also enforced by the database. */
export const PAYMENT_DATE_RANGE = { min: "2000-01-01", max: "2100-12-31" } as const;

/** A payment's due status, in display order of urgency. */
export const PAYMENT_DUE_STATUSES = ["OVERDUE", "DUE_TODAY", "UPCOMING", "PAID"] as const;
export type PaymentDueStatus = (typeof PAYMENT_DUE_STATUSES)[number];

type Definition = { label: string; description: string };

export const PAYMENT_DUE_STATUS_DEFINITIONS: Record<PaymentDueStatus, Definition> = {
  OVERDUE: { label: "Overdue", description: "Not paid, and the due date has passed." },
  DUE_TODAY: { label: "Due today", description: "Not paid, and due today." },
  UPCOMING: { label: "Upcoming", description: "Not paid, and due on a later day." },
  PAID: { label: "Paid", description: "Recorded as paid. Never overdue, whenever it was due." },
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written "YYYY-MM-DD" (no 30 February), in any year. */
export function isCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Today's calendar date in the Philippines for a given instant: "2026-10-14". */
export function manilaToday(now: Date): string {
  // Asia/Manila is UTC+8 all year (no daylight saving), so this is exact for every instant.
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" from a DATE column value (Prisma returns midnight UTC of that day). */
export function toCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "Nov 15, 2026" from "2026-11-15". The day is shown as written: no time zone shift. */
export function formatCalendarDate(value: string): string {
  if (!isCalendarDate(value)) throw new Error("Not a calendar date (YYYY-MM-DD).");
  return DATE_FORMAT.format(new Date(`${value}T00:00:00.000Z`));
}

/** What the rule reads from one payment. */
export type PaymentForDue = { status: "UNPAID" | "PAID"; dueDate: string };

/**
 * The due status (D-079):
 * - Paid: recorded as paid. Never overdue, whether it was paid early, on time or late.
 * - Overdue: unpaid, and the due date is before today.
 * - Due today: unpaid, and due today.
 * - Upcoming: unpaid, and due on a later day.
 */
export function paymentDueStatus(payment: PaymentForDue, today: string): PaymentDueStatus {
  if (!isCalendarDate(payment.dueDate) || !isCalendarDate(today)) {
    throw new Error("Due dates and today must be calendar dates (YYYY-MM-DD).");
  }
  if (payment.status === "PAID") return "PAID";
  if (payment.dueDate < today) return "OVERDUE";
  if (payment.dueDate === today) return "DUE_TODAY";
  return "UPCOMING";
}

export type SupplierDueSummary = {
  /** How many of the supplier's payments are overdue. */
  overdueCount: number;
  /** The earliest unpaid payment by due date (overdue ones first), or null when all are paid. */
  next: { dueDate: string; dueStatus: Exclude<PaymentDueStatus, "PAID"> } | null;
};

/** A supplier's due summary for lists and its page (D-079). */
export function supplierDueSummary(
  payments: readonly PaymentForDue[],
  today: string,
): SupplierDueSummary {
  let overdueCount = 0;
  let next: SupplierDueSummary["next"] = null;
  for (const payment of payments) {
    const dueStatus = paymentDueStatus(payment, today);
    if (dueStatus === "PAID") continue;
    if (dueStatus === "OVERDUE") overdueCount += 1;
    if (!next || payment.dueDate < next.dueDate) next = { dueDate: payment.dueDate, dueStatus };
  }
  return { overdueCount, next };
}