// src/modules/events/suppliers/payment-form-state.ts
// State shared by the payment form and its server actions (B4-14). Separate from the actions file
// because a "use server" file may only export async functions.
import type { PaymentField } from "./payment-schema";

export type PaymentFormState = {
  status: "idle" | "error" | "success";
  /** Form-level message, already safe to show. */
  message?: string;
  fieldErrors?: Partial<Record<PaymentField, string>>;
  /** What the user typed, so a failed submit keeps it. */
  values?: Partial<Record<PaymentField, string>>;
};

export const initialPaymentFormState: PaymentFormState = { status: "idle" };

/** Messages for payment actions. Never include internal error details. */
export const PAYMENT_MESSAGES = {
  unchanged: "No changes to save.",
  forbidden: "Your role can view payments but not change them. Ask an Owner or Coordinator.",
  eventNotFound: "This event isn't available. Go back to your events and open it again.",
  supplierNotFound: "This supplier isn't available. They may have been removed.",
  paymentNotFound: "This payment isn't available. Its supplier may have been removed.",
  stale:
    "This payment changed since you opened it. Reload to see the latest details, then make your change again.",
  saveFailed: "We couldn't save the payment. Nothing was saved. Try again in a moment.",
} as const;