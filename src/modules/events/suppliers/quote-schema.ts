// src/modules/events/suppliers/quote-schema.ts
// Validation for quote input (B4-09 add, B4-10 edit; D-075, D-076). Forms send strings; this schema
// turns them into checked values: the amount as a canonical peso string (money.ts, never a
// JavaScript number), a canonical status, and an optional description. The same schema checks the
// form in the browser and again on the server. Pure: no database, no clock, safe for client
// components.
import { z } from "zod";
// Type-only: the quote form is a client component, so this file must not pull in server code.
import type { QuoteChanges } from "@/modules/events/audit/public";
import { parsePesoAmount, toPesoInput } from "./money";
import { QUOTE_STATUSES, type QuoteStatus } from "./quote-statuses";

export const QUOTE_LIMITS = { description: 120 } as const;

/** Characters as Postgres counts them (code points), like varchar(n). */
const charCount = (value: string) => Array.from(value).length;

export const quoteStatusSchema = z.enum(QUOTE_STATUSES, {
  message: "Choose the quote's status.",
});

/**
 * What the quote form sends. Every value is a string; an empty description is "". The amount is
 * required; the status defaults to nothing, so the form must send one of the canonical values.
 */
export const quoteFormSchema = z.object({
  amount: z.string().transform((value, ctx) => {
    const parsed = parsePesoAmount(value);
    if (!parsed.ok) {
      ctx.addIssue({ code: "custom", message: parsed.message });
      return z.NEVER;
    }
    return parsed.value;
  }),
  status: z.string().trim().pipe(quoteStatusSchema),
  description: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .refine((value) => !value.includes("\u0000"), {
      message: "Remove the invisible character this text contains, then try again.",
    })
    .refine((value) => charCount(value) <= QUOTE_LIMITS.description, {
      message: `Use ${QUOTE_LIMITS.description} characters or fewer.`,
    })
    .transform((value) => (value === "" ? null : value)),
});

export type QuoteField = "amount" | "status" | "description";
export const QUOTE_FIELDS: readonly QuoteField[] = ["amount", "status", "description"];

/** The checked values the quote use cases store. `amount` is canonical, for example "120000.50". */
export type QuoteInput = { amount: string; status: QuoteStatus; description: string | null };

/** A stored quote as form values (for the edit form): the reverse of the schema. */
export function toQuoteFormValues(quote: QuoteInput): Record<QuoteField, string> {
  return {
    amount: toPesoInput(quote.amount),
    status: quote.status,
    description: quote.description ?? "",
  };
}

/** "QUO-0001": the readable quote ID, at least four digits (D-075). */
export function formatQuoteReference(number: number): string {
  return `QUO-${String(number).padStart(4, "0")}`;
}

/** True for a well-formed readable quote ID, for example from a URL. Nothing else is trusted. */
export function isQuoteReference(value: unknown): value is string {
  return typeof value === "string" && /^QUO-\d{4,9}$/.test(value);
}

/**
 * What changed, for the audit log (D-037, D-076). Amount, status and description are business
 * facts, recorded old → new. Empty when nothing changed.
 */
export function quoteChanges(before: QuoteInput, after: QuoteInput): QuoteChanges {
  const changes: QuoteChanges = {};
  if (before.amount !== after.amount) changes.amount = { from: before.amount, to: after.amount };
  if (before.status !== after.status) changes.status = { from: before.status, to: after.status };
  if (before.description !== after.description) {
    changes.description = { from: before.description, to: after.description };
  }
  return changes;
}