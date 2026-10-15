// src/modules/events/suppliers/quote-form-state.ts
// State shared by the quote form and its server actions (B4-09, B4-10). Separate from the actions
// file because a "use server" file may only export async functions.
import type { QuoteField } from "./quote-schema";

export type QuoteFormState = {
  status: "idle" | "error" | "success";
  /** Form-level message, already safe to show. */
  message?: string;
  fieldErrors?: Partial<Record<QuoteField, string>>;
  /** What the user typed, so a failed submit keeps it. */
  values?: Partial<Record<QuoteField, string>>;
};

export const initialQuoteFormState: QuoteFormState = { status: "idle" };

/** Messages for quote actions. Never include internal error details. */
export const QUOTE_MESSAGES = {
  unchanged: "No changes to save.",
  forbidden: "Your role can view quotes but not change them. Ask an Owner or Coordinator.",
  eventNotFound: "This event isn't available. Go back to your events and open it again.",
  supplierNotFound: "This supplier isn't available. They may have been removed.",
  quoteNotFound: "This quote isn't available. Its supplier may have been removed.",
  stale:
    "This quote changed since you opened it. Reload to see the latest details, then make your change again.",
  saveFailed: "We couldn't save the quote. Nothing was saved. Try again in a moment.",
} as const;