// src/modules/events/suppliers/payment-schema.ts
// Validation for supplier payment input (B4-14; D-077, D-079). Forms send strings; this schema turns
// them into checked values: the amount as a canonical peso string (money.ts, never a number),
// calendar dates as "YYYY-MM-DD" within 2000 to 2100, the canonical kind and recorded status, and
// the paid date only for a Paid payment, never after today in Manila. "Today" is passed in by the
// server (manilaToday), so the same rules run in the browser and again, authoritatively, on the
// server. Pure: safe for client components.
import { z } from "zod";
// Type-only: the payment form is a client component, so this file must not pull in server code.
import type { PaymentChanges } from "@/modules/events/audit/public";
import { parsePesoAmount, toPesoInput } from "./money";
import {
  PAYMENT_KINDS,
  PAYMENT_RECORD_STATUSES,
  type PaymentKind,
  type PaymentRecordStatus,
} from "./payment-definitions";
import { PAYMENT_DATE_RANGE, formatCalendarDate, isCalendarDate } from "./payment-due";

export const PAYMENT_LIMITS = { description: 120 } as const;

const charCount = (value: string) => Array.from(value).length;
const inRange = (value: string) =>
  value >= PAYMENT_DATE_RANGE.min && value <= PAYMENT_DATE_RANGE.max;
const RANGE_MESSAGE = `Enter a date from ${formatCalendarDate(PAYMENT_DATE_RANGE.min)} to ${formatCalendarDate(PAYMENT_DATE_RANGE.max)}.`;

/** A calendar date field: "" stays "" (checked by the caller), otherwise a real date in range. */
const dateField = (requiredMessage: string) =>
  z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") {
        if (requiredMessage) ctx.addIssue({ code: "custom", message: requiredMessage });
        return;
      }
      if (!isCalendarDate(value)) {
        ctx.addIssue({ code: "custom", message: "Enter a real date, for example 2026-11-15." });
      } else if (!inRange(value)) {
        ctx.addIssue({ code: "custom", message: RANGE_MESSAGE });
      }
    });

/** The payment form's rules for a given day (today in Manila, "YYYY-MM-DD"). */
export function paymentFormSchema(today: string) {
  return z
    .object({
      kind: z
        .string()
        .trim()
        .pipe(z.enum(PAYMENT_KINDS, { message: "Choose deposit or payment." })),
      amount: z.string().transform((value, ctx) => {
        const parsed = parsePesoAmount(value);
        if (!parsed.ok) {
          ctx.addIssue({ code: "custom", message: parsed.message });
          return z.NEVER;
        }
        return parsed.value;
      }),
      dueDate: dateField("Enter the due date."),
      status: z
        .string()
        .trim()
        .pipe(z.enum(PAYMENT_RECORD_STATUSES, { message: "Choose whether it has been paid." })),
      paidOn: dateField(""),
      description: z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .refine((value) => !value.includes("\u0000"), {
          message: "Remove the invisible character this text contains, then try again.",
        })
        .refine((value) => charCount(value) <= PAYMENT_LIMITS.description, {
          message: `Use ${PAYMENT_LIMITS.description} characters or fewer.`,
        })
        .transform((value) => (value === "" ? null : value)),
    })
    .superRefine(
      (value, ctx) => {
        if (value.status !== "PAID") return;
        if (value.paidOn === "") {
          ctx.addIssue({
            code: "custom",
            path: ["paidOn"],
            message: "Enter the day it was paid.",
          });
        } else if (isCalendarDate(value.paidOn) && value.paidOn > today) {
          ctx.addIssue({
            code: "custom",
            path: ["paidOn"],
            message: "The paid date can't be in the future.",
          });
        }
      },
      // Runs even when other fields have errors, so a missing paid date is listed with them (B4-23),
      // unless the status or paid date has an error of its own.
      {
        when: (payload) =>
          !payload.issues.some((issue) => ["status", "paidOn"].includes(String(issue.path?.[0]))),
      },
    )
    .transform((value) => ({
      ...value,
      // Only a Paid payment has a paid date; one left in a hidden field is never stored.
      paidOn: value.status === "PAID" ? value.paidOn : null,
    }));
}

export type PaymentField = "kind" | "amount" | "dueDate" | "status" | "paidOn" | "description";
export const PAYMENT_FIELDS: readonly PaymentField[] = [
  "kind",
  "amount",
  "dueDate",
  "status",
  "paidOn",
  "description",
];

/** The checked values the payment use cases store. Amount and dates are canonical strings. */
export type PaymentInput = {
  kind: PaymentKind;
  amount: string;
  dueDate: string;
  status: PaymentRecordStatus;
  paidOn: string | null;
  description: string | null;
};

/** A stored payment as form values (for the edit form): the reverse of the schema. */
export function toPaymentFormValues(payment: PaymentInput): Record<PaymentField, string> {
  return {
    kind: payment.kind,
    amount: toPesoInput(payment.amount),
    dueDate: payment.dueDate,
    status: payment.status,
    paidOn: payment.paidOn ?? "",
    description: payment.description ?? "",
  };
}

/** "PAY-0001": the readable payment ID, at least four digits (D-077). */
export function formatPaymentReference(number: number): string {
  return `PAY-${String(number).padStart(4, "0")}`;
}

/** True for a well-formed readable payment ID, for example from a URL. Nothing else is trusted. */
export function isPaymentReference(value: unknown): value is string {
  return typeof value === "string" && /^PAY-\d{4,9}$/.test(value);
}

/** What changed, for the audit log (D-037, D-077): business facts, old → new. */
export function paymentChanges(before: PaymentInput, after: PaymentInput): PaymentChanges {
  const changes: PaymentChanges = {};
  for (const field of ["kind", "amount", "dueDate", "status", "paidOn", "description"] as const) {
    if (before[field] !== after[field]) {
      (changes as Record<string, unknown>)[field] = { from: before[field], to: after[field] };
    }
  }
  return changes;
}