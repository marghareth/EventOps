// src/modules/events/suppliers/quote-actions.ts
// Quote server actions (B4-09 add, B4-10 edit; D-075, D-076). Server actions are public HTTP endpoints, so each
// one authorizes first with authorizeEvent(eventId, "suppliers.manage") (D-035, D-036) and
// validates every input on the server with the shared quote schema. The event and supplier come
// only from the bound arguments; the use cases find the supplier only inside the authorized event
// and re-check the role in the database.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsFrom } from "@/lib/auth-rules";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import {
  authorizeEvent,
  sampleCreateQuote,
  sampleGetQuote,
  sampleUpdateQuote,
} from "@/modules/events/public";
import { createQuote, type CreateQuoteResult } from "./create-quote";
import { QUOTE_MESSAGES as MESSAGES, type QuoteFormState } from "./quote-form-state";
import { QUOTE_FIELDS, quoteChanges, quoteFormSchema, type QuoteField } from "./quote-schema";
import { anotherAcceptedMessage } from "./quote-statuses";
import { updateQuote, type UpdateQuoteResult } from "./update-quote";

const idSchema = z.uuid();
const versionSchema = z.iso.datetime();

const REFUSED = { "not-found": MESSAGES.eventNotFound, forbidden: MESSAGES.forbidden } as const;

const supplierPath = (eventId: string, supplierId: string) =>
  `/events/${encodeURIComponent(eventId)}/suppliers/${encodeURIComponent(supplierId)}`;

function formValues(formData: FormData): Record<QuoteField, string> {
  const values = {} as Record<QuoteField, string>;
  for (const field of QUOTE_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/**
 * Adds a quote to a supplier, then opens the supplier's page with an "added" notice (B4-09).
 * Owners and Coordinators (suppliers.manage). Accepting is refused while another quote of the
 * supplier is Accepted (D-076).
 */
export async function createQuoteAction(
  eventId: string,
  supplierId: string,
  _previous: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const auth = await authorizeEvent(eventId, "suppliers.manage", supplierPath(eventId, supplierId));
  const values = formValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };
  if (!idSchema.safeParse(supplierId).success) {
    return { status: "error", message: MESSAGES.supplierNotFound, values };
  }
  const parsed = quoteFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  let result: CreateQuoteResult;
  try {
    const args = {
      eventId: auth.event.id,
      supplierId,
      creatorId: auth.user.id,
      quote: parsed.data,
    };
    result = isSampleDataMode()
      ? sampleCreateQuote({ ...args, now: new Date() }) // Dev-only sample data (D-041).
      : await createQuote(getDb(), args);
  } catch {
    // Database unreachable or a constraint failed: nothing was saved (one transaction).
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  if (!result.ok) {
    if (result.reason === "another-accepted") {
      return {
        status: "error",
        fieldErrors: { status: anotherAcceptedMessage(result.reference) },
        values,
      };
    }
    // Another event's supplier, a removed supplier, or the role changed after the check above.
    return { status: "error", message: MESSAGES.supplierNotFound, values };
  }

  const path = supplierPath(auth.event.id, supplierId);
  revalidatePath(path);
  // redirect() works by throwing, so it stays outside the try block.
  redirect(`${path}?quoteAdded=${encodeURIComponent(result.quote.reference)}`);
}

/**
 * Saves a quote's amount, status and description, unless someone else saved it first (D-032), then
 * opens the supplier's page with a "saved" notice (B4-10). Nothing changed: says so and records
 * nothing. Accepting is refused while another quote of the supplier is Accepted (D-076). The event,
 * supplier and quote come only from the bound arguments; the quote is found only for this supplier
 * of the authorized event, so anything else is "not found".
 */
export async function updateQuoteAction(
  eventId: string,
  supplierId: string,
  quoteId: string,
  _previous: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const auth = await authorizeEvent(eventId, "suppliers.manage", supplierPath(eventId, supplierId));
  const values = formValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };
  if (!idSchema.safeParse(supplierId).success || !idSchema.safeParse(quoteId).success) {
    return { status: "error", message: MESSAGES.quoteNotFound, values };
  }
  const parsed = quoteFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  const version = versionSchema.safeParse(formData.get("version"));
  if (!version.success) return { status: "error", message: MESSAGES.stale, values };

  const sample = isSampleDataMode(); // Dev-only sample data (D-041).
  let result: UpdateQuoteResult;
  try {
    const args = {
      eventId: auth.event.id,
      supplierId,
      quoteId,
      editorId: auth.user.id,
      version: new Date(version.data),
      quote: parsed.data,
      now: new Date(),
    };
    if (sample) {
      const current = sampleGetQuote(auth.event.id, supplierId, quoteId);
      const changes = current ? quoteChanges(current, parsed.data) : {};
      result = sampleUpdateQuote({ ...args, changes });
    } else {
      result = await updateQuote(getDb(), args);
    }
  } catch {
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  if (!result.ok) {
    if (result.reason === "another-accepted") {
      return {
        status: "error",
        fieldErrors: { status: anotherAcceptedMessage(result.reference) },
        values,
      };
    }
    const message = result.reason === "stale" ? MESSAGES.stale : MESSAGES.quoteNotFound;
    return { status: "error", message, values };
  }
  if (!result.changed) return { status: "success", message: MESSAGES.unchanged };

  const path = supplierPath(auth.event.id, supplierId);
  revalidatePath(path);
  // redirect() works by throwing, so it stays outside the try block.
  redirect(`${path}?quoteSaved=${encodeURIComponent(result.reference)}`);
}