// src/modules/events/budget/schema.ts
// Zod schemas for the budget forms (B5-F01, B5-F02; D-084, D-085). The server actions parse the raw
// FormData strings with these on every request; the browser never decides what is valid. Amounts
// leave here as exact two-place strings ("1500.00"), and empty notes leave as null.
import { z } from "zod";
import { BUDGET_CATEGORY_NAME_MAX } from "./domain/budget.category";
import { BUDGET_ITEM_NAME_MAX, BUDGET_ITEM_NOTES_MAX } from "./domain/budget.item";
import { parsePesos } from "./domain/budget.money";

export const CATEGORY_FIELDS = ["name", "allocation"] as const;
export type CategoryField = (typeof CATEGORY_FIELDS)[number];

export const ITEM_FIELDS = [
  "categoryId",
  "name",
  "estimated",
  "committed",
  "paid",
  "notes",
] as const;
export type ItemField = (typeof ITEM_FIELDS)[number];

const MONEY_MESSAGES = {
  empty: (label: string) => `Enter ${label}. Use 0 if there is none.`,
  format: () => "Enter a peso amount with at most two decimals, for example 1,500.50.",
  negative: (label: string) => `${label} can't be negative.`,
  "too-large": () => "That amount is too large. The most is ₱9,999,999,999.99.",
} as const;

/**
 * A peso amount of ₱0.00 or more, as the exact string the database stores. With `emptyIsZero`, a
 * blank field is stored as ₱0.00 (committed and paid, D-085); otherwise a blank field is an error.
 */
const pesos = (label: string, emptyIsZero = false) =>
  z.string().transform((raw, ctx) => {
    if (emptyIsZero && raw.trim() === "") return "0.00";
    const parsed = parsePesos(raw);
    if (parsed.ok) return parsed.value;
    ctx.addIssue({ code: "custom", message: MONEY_MESSAGES[parsed.reason](label) });
    return z.NEVER;
  });

/** Trimmed; with `collapse`, runs of inner spaces become one space (category names, D-084). */
const name = (what: string, max: number, collapse = false) =>
  z
    .string()
    .transform((value) => (collapse ? value.trim().replace(/\s+/g, " ") : value.trim()))
    .pipe(
      z
        .string()
        .min(1, `Enter ${what} name.`)
        .max(max, `Keep the name to ${max} characters or fewer.`),
    );

export const categoryFormSchema = z.object({
  name: name("a category", BUDGET_CATEGORY_NAME_MAX, true),
  allocation: pesos("an allocation"),
});
export type CategoryInput = z.infer<typeof categoryFormSchema>;

export const itemFormSchema = z.object({
  categoryId: z.uuid("Choose a category."),
  name: name("an item", BUDGET_ITEM_NAME_MAX),
  estimated: pesos("an estimated amount"),
  committed: pesos("a committed amount", true),
  paid: pesos("a paid amount", true),
  notes: z
    .string()
    .trim()
    .max(BUDGET_ITEM_NOTES_MAX, `Keep the notes to ${BUDGET_ITEM_NOTES_MAX} characters or fewer.`)
    .transform((value) => (value === "" ? null : value)),
});
export type ItemInput = z.infer<typeof itemFormSchema>;