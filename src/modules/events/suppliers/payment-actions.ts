// src/modules/events/suppliers/payment-actions.ts
// Supplier payment server actions (B4-14; D-077, D-079). Server actions are public HTTP endpoints,
// so each one authorizes first with authorizeEvent(eventId, "suppliers.manage") (D-035, D-036) and
// validates every input on the server with the shared payment schema, for today's date in Manila
// worked out here. No financial or date rule is left to the browser. The event, supplier and
// payment come only from the bound arguments; the use cases find them only inside the authorized
// event and re-check the role in the database.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsFrom } from "@/lib/auth-rules";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import {
  authorizeEvent,
  sampleCreatePayment,
  sampleGetPayment,
  sampleUpdatePayment,
} from "@/modules/events/public";
import { createPayment, type CreatePaymentResult } from "./create-payment";
import { manilaToday } from "./payment-due";
import { PAYMENT_MESSAGES as MESSAGES, type PaymentFormState } from "./payment-form-state";
import {
  PAYMENT_FIELDS,
  paymentChanges,
  paymentFormSchema,
  type PaymentField,
} from "./payment-schema";
import { updatePayment, type UpdatePaymentResult } from "./update-payment";

const idSchema = z.uuid();
const versionSchema = z.iso.datetime();

const REFUSED = { "not-found": MESSAGES.eventNotFound, forbidden: MESSAGES.forbidden } as const;

const supplierPath = (eventId: string, supplierId: string) =>
  `/events/${encodeURIComponent(eventId)}/suppliers/${encodeURIComponent(supplierId)}`;

function formValues(formData: FormData): Record<PaymentField, string> {
  const values = {} as Record<PaymentField, string>;
  for (const field of PAYMENT_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/**
 * Adds a deposit or payment to a supplier, then opens the supplier's page with an "added" notice
 * (B4-14). Owners and Coordinators (suppliers.manage).
 */
export async function createPaymentAction(
  eventId: string,
  supplierId: string,
  _previous: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const auth = await authorizeEvent(eventId, "suppliers.manage", supplierPath(eventId, supplierId));
  const values = formValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };
  if (!idSchema.safeParse(supplierId).success) {
    return { status: "error", message: MESSAGES.supplierNotFound, values };
  }
  const parsed = paymentFormSchema(manilaToday(new Date())).safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  let result: CreatePaymentResult;
  try {
    const args = {
      eventId: auth.event.id,
      supplierId,
      creatorId: auth.user.id,
      payment: parsed.data,
    };
    result = isSampleDataMode()
      ? sampleCreatePayment({ ...args, now: new Date() }) // Dev-only sample data (D-041).
      : await createPayment(getDb(), args);
  } catch {
    // Database unreachable or a constraint failed: nothing was saved (one transaction).
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  // Another event's supplier, a removed supplier, or the role changed after the check above.
  if (!result.ok) return { status: "error", message: MESSAGES.supplierNotFound, values };

  const path = supplierPath(auth.event.id, supplierId);
  revalidatePath(path);
  // redirect() works by throwing, so it stays outside the try block.
  redirect(`${path}?paymentAdded=${encodeURIComponent(result.payment.reference)}`);
}

/**
 * Saves a payment, unless someone else saved it first (D-032), then opens the supplier's page with
 * a "saved" notice (B4-14). Nothing changed: says so and records nothing. The payment is found only
 * for this supplier of the authorized event, so anything else is "not found".
 */
export async function updatePaymentAction(
  eventId: string,
  supplierId: string,
  paymentId: string,
  _previous: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const auth = await authorizeEvent(eventId, "suppliers.manage", supplierPath(eventId, supplierId));
  const values = formValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };
  if (!idSchema.safeParse(supplierId).success || !idSchema.safeParse(paymentId).success) {
    return { status: "error", message: MESSAGES.paymentNotFound, values };
  }
  const parsed = paymentFormSchema(manilaToday(new Date())).safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  const version = versionSchema.safeParse(formData.get("version"));
  if (!version.success) return { status: "error", message: MESSAGES.stale, values };

  let result: UpdatePaymentResult;
  try {
    const args = {
      eventId: auth.event.id,
      supplierId,
      paymentId,
      editorId: auth.user.id,
      version: new Date(version.data),
      payment: parsed.data,
    };
    if (isSampleDataMode()) {
      // Dev-only sample data (D-041).
      const current = sampleGetPayment(auth.event.id, supplierId, paymentId);
      const changes = current ? paymentChanges(current, parsed.data) : {};
      result = sampleUpdatePayment({ ...args, changes, now: new Date() });
    } else {
      result = await updatePayment(getDb(), args);
    }
  } catch {
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  if (!result.ok) {
    const message = result.reason === "stale" ? MESSAGES.stale : MESSAGES.paymentNotFound;
    return { status: "error", message, values };
  }
  if (!result.changed) return { status: "success", message: MESSAGES.unchanged };

  const path = supplierPath(auth.event.id, supplierId);
  revalidatePath(path);
  redirect(`${path}?paymentSaved=${encodeURIComponent(result.reference)}`);
}