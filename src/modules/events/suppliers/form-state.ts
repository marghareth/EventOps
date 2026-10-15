// src/modules/events/suppliers/form-state.ts
// State shared by supplier forms and their server actions (B4-03). Separate from actions.ts because
// a "use server" file may only export async functions.
import type { SupplierField } from "./schema";

export type SupplierFormState = {
  status: "idle" | "error" | "success";
  /** Form-level message, already safe to show. */
  message?: string;
  fieldErrors?: Partial<Record<SupplierField, string>>;
  /** What the user typed, so a failed submit keeps it. */
  values?: Partial<Record<SupplierField, string>>;
};

export const initialSupplierFormState: SupplierFormState = { status: "idle" };

/** State of the remove-supplier confirmation (B4-05). */
export type DeleteSupplierFormState = { status: "idle" | "error"; message?: string };

export const initialDeleteSupplierState: DeleteSupplierFormState = { status: "idle" };

/** Messages for supplier actions. Never include internal error details. */
export const SUPPLIER_MESSAGES = {
  saved: "Changes saved.",
  unchanged: "No changes to save.",
  forbidden: "Your role can view suppliers but not change them. Ask an Owner or Coordinator.",
  eventNotFound: "This event isn't available. Go back to your events and open it again.",
  supplierNotFound: "This supplier isn't available. They may have been removed.",
  stale:
    "This supplier changed since you opened it. Reload to see the latest details, then make your change again.",
  saveFailed: "We couldn't save the supplier. Try again in a moment.",
  deleteFailed: "We couldn't remove the supplier. Nothing was removed. Try again in a moment.",
} as const;