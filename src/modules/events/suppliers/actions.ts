// src/modules/events/suppliers/actions.ts
// Supplier server actions (B4-03 add, B4-04 edit, B4-05 remove; D-070 to D-072). Server actions
// are public HTTP endpoints, so each one authorizes first with
// authorizeEvent(eventId, "suppliers.manage") (D-035, D-036) and validates every input on the
// server with the shared schema. The event comes only from the bound argument and is checked; the
// use cases re-check the role in the database.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsFrom } from "@/lib/auth-rules";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import {
  authorizeEvent,
  sampleCreateSupplier,
  sampleDeleteSupplier,
  sampleGetSupplier,
  sampleUpdateSupplier,
} from "@/modules/events/public";
import { createSupplier, type CreateSupplierResult } from "./create-supplier";
import { deleteSupplier, type DeleteSupplierResult } from "./delete-supplier";
import {
  SUPPLIER_MESSAGES as MESSAGES,
  type DeleteSupplierFormState,
  type SupplierFormState,
} from "./form-state";
import { getSupplier } from "./queries";
import {
  SUPPLIER_FIELDS,
  formatSupplierReference,
  supplierChanges,
  supplierFormSchema,
  type SupplierField,
} from "./schema";
import { updateSupplier, type UpdateSupplierResult } from "./update-supplier";

const idSchema = z.uuid();
const versionSchema = z.iso.datetime();

const REFUSED = { "not-found": MESSAGES.eventNotFound, forbidden: MESSAGES.forbidden } as const;

const suppliersPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/suppliers`;

function formValues(formData: FormData): Record<SupplierField, string> {
  const values = {} as Record<SupplierField, string>;
  for (const field of SUPPLIER_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/**
 * Adds a supplier to the event, then opens the supplier list with an "added" notice (B4-03).
 * Owners and Coordinators (suppliers.manage).
 */
export async function createSupplierAction(
  eventId: string,
  _previous: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const auth = await authorizeEvent(eventId, "suppliers.manage", suppliersPath(eventId));
  const values = formValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };

  const parsed = supplierFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  let result: CreateSupplierResult;
  try {
    const args = { eventId: auth.event.id, creatorId: auth.user.id, supplier: parsed.data };
    // Dev-only sample data (D-041): kept in memory until the dev server restarts.
    result = isSampleDataMode()
      ? sampleCreateSupplier({ ...args, now: new Date() })
      : await createSupplier(getDb(), args);
  } catch {
    // Database unreachable or a constraint failed: nothing was saved (one transaction).
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  // Refused in the database: the role changed after the check above.
  if (!result.ok) return { status: "error", message: MESSAGES.forbidden, values };

  revalidatePath(suppliersPath(auth.event.id));
  // redirect() works by throwing, so it stays outside the try block.
  redirect(
    `${suppliersPath(auth.event.id)}?added=${encodeURIComponent(result.supplier.reference)}`,
  );
}

/**
 * Saves a supplier's details, unless someone else saved them first (D-032), then opens the supplier
 * list with a "saved" notice (B4-04). Nothing changed: says so and records nothing. The event and
 * supplier come only from the bound arguments; the supplier is looked up only inside the authorized
 * event, so another event's supplier is "not found".
 */
export async function updateSupplierAction(
  eventId: string,
  supplierId: string,
  _previous: SupplierFormState,
  formData: FormData,
): Promise<SupplierFormState> {
  const auth = await authorizeEvent(eventId, "suppliers.manage", suppliersPath(eventId));
  const values = formValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };
  if (!idSchema.safeParse(supplierId).success) {
    return { status: "error", message: MESSAGES.supplierNotFound, values };
  }
  const parsed = supplierFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  const version = versionSchema.safeParse(formData.get("version"));
  if (!version.success) return { status: "error", message: MESSAGES.stale, values };

  const sample = isSampleDataMode(); // Dev-only sample data (D-041).
  let reference: string;
  try {
    const current = sample
      ? sampleGetSupplier(auth.event.id, supplierId)
      : await getSupplier(getDb(), auth.event.id, supplierId);
    if (!current) return { status: "error", message: MESSAGES.supplierNotFound, values };
    const changes = supplierChanges(current, parsed.data);
    if (Object.keys(changes).length === 0)
      return { status: "success", message: MESSAGES.unchanged };
    reference = formatSupplierReference(current.number);

    const args = {
      eventId: auth.event.id,
      supplierId,
      editorId: auth.user.id,
      version: new Date(version.data),
      details: parsed.data,
    };
    const result: UpdateSupplierResult = sample
      ? sampleUpdateSupplier({ ...args, changes, now: new Date() })
      : await updateSupplier(getDb(), args);
    if (!result.ok) {
      const message = result.reason === "stale" ? MESSAGES.stale : MESSAGES.supplierNotFound;
      return { status: "error", message, values };
    }
  } catch {
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  revalidatePath(suppliersPath(auth.event.id));
  // redirect() works by throwing, so it stays outside the try block.
  redirect(`${suppliersPath(auth.event.id)}?saved=${encodeURIComponent(reference)}`);
}

/**
 * Permanently removes a supplier (B4-05, D-072), then opens the supplier list with a "removed"
 * notice. The event and supplier come only from the bound arguments; the supplier is removed only
 * inside the authorized event, so another event's supplier is "not found" and nothing is removed.
 */
export async function deleteSupplierAction(
  eventId: string,
  supplierId: string,
): Promise<DeleteSupplierFormState> {
  const auth = await authorizeEvent(eventId, "suppliers.manage", suppliersPath(eventId));
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason] };
  if (!idSchema.safeParse(supplierId).success) {
    return { status: "error", message: MESSAGES.supplierNotFound };
  }

  let result: DeleteSupplierResult;
  try {
    const args = { eventId: auth.event.id, supplierId, userId: auth.user.id };
    result = isSampleDataMode()
      ? sampleDeleteSupplier({ ...args, now: new Date() }) // Dev-only sample data (D-041).
      : await deleteSupplier(getDb(), args);
  } catch {
    return { status: "error", message: MESSAGES.deleteFailed };
  }
  // Already removed, another event's supplier, or the role changed after the check above.
  if (!result.ok) return { status: "error", message: MESSAGES.supplierNotFound };

  revalidatePath(suppliersPath(auth.event.id));
  // redirect() works by throwing, so it stays outside the try block.
  redirect(`${suppliersPath(auth.event.id)}?removed=${encodeURIComponent(result.reference)}`);
}