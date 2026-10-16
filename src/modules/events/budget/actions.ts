// src/modules/events/budget/actions.ts
// Budget server actions (B5-F01 categories, B5-F02 items; D-084, D-085). Server actions are public
// HTTP endpoints, so each one authorizes first with authorizeEvent(eventId, "budget.manage")
// (D-035, D-036) and validates every input on the server with the shared schemas. The event comes
// only from the bound argument and is checked; category and item IDs are looked up only inside the
// authorized event, so another event's record is "not found". The repository re-checks the role in
// the database.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsFrom } from "@/lib/auth-rules";
import { authorizeEvent } from "@/modules/events/public";
import { addCategory } from "./application/add-category";
import { addItem } from "./application/add-item";import { removeCategory } from "./application/remove-category";
import { removeItem } from "./application/remove-item";
import { updateItem } from "./application/update-item";
import { budgetRepository } from "./composition";
import { formatBudgetItemReference } from "./domain/budget.item";
import {
  BUDGET_MESSAGES as MESSAGES,
  type CategoryFormState,
  type DeleteFormState,
  type ItemFormState,
} from "./form-state";
import {
  CATEGORY_FIELDS,
  ITEM_FIELDS,
  categoryFormSchema,
  itemFormSchema,
  type CategoryField,
  type ItemField,
} from "./schema";
import { updateCategory } from "./application/update-category";

const idSchema = z.uuid();
const versionSchema = z.iso.datetime();

const REFUSED = { "not-found": MESSAGES.eventNotFound, forbidden: MESSAGES.forbidden } as const;

const budgetPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/budget`;

/** The notice the budget page shows after a change: a kind and, where there is one, a reference. */
const noticeUrl = (eventId: string, notice: string, ref?: string) =>
  `${budgetPath(eventId)}?notice=${notice}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`;

function categoryValues(formData: FormData): Record<CategoryField, string> {
  const values = {} as Record<CategoryField, string>;
  for (const field of CATEGORY_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

function itemValues(formData: FormData): Record<ItemField, string> {
  const values = {} as Record<ItemField, string>;
  for (const field of ITEM_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

// ───────────────────────────── Categories ─────────────────────────────

/** Adds a category, then opens the budget with an "added" notice (B5-F01). Owners and Coordinators. */
export async function createCategoryAction(
  eventId: string,
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const auth = await authorizeEvent(eventId, "budget.manage", budgetPath(eventId));
  const values = categoryValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };

  const parsed = categoryFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  let id: string;
  try {
    const result = await addCategory(budgetRepository(), {
      eventId: auth.event.id,
      actorId: auth.user.id,
      input: parsed.data,
    });
    if (!result.ok) {
      if (result.reason === "duplicate") {
        return { status: "error", fieldErrors: { name: MESSAGES.duplicateName }, values };
      }
      // The role changed after the check above: refused in the database.
      return { status: "error", message: MESSAGES.forbidden, values };
    }
    id = result.id;
  } catch {
    // Database unreachable or a constraint failed: nothing was saved (one transaction).
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  revalidatePath(budgetPath(auth.event.id));
  // redirect() works by throwing, so it stays outside the try block.
  redirect(noticeUrl(auth.event.id, "category-added", id));
}

/**
 * Saves a category's name and allocation, unless someone else saved it first (D-032), then opens
 * the budget with a "saved" notice. Nothing changed: says so and records nothing.
 */
export async function updateCategoryAction(
  eventId: string,
  categoryId: string,
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const auth = await authorizeEvent(eventId, "budget.manage", budgetPath(eventId));
  const values = categoryValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };
  if (!idSchema.safeParse(categoryId).success) {
    return { status: "error", message: MESSAGES.categoryNotFound, values };
  }
  const parsed = categoryFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  const version = versionSchema.safeParse(formData.get("version"));
  if (!version.success) return { status: "error", message: MESSAGES.categoryStale, values };

  try {
    const result = await updateCategory(budgetRepository(), {
      eventId: auth.event.id,
      categoryId,
      actorId: auth.user.id,
      version: new Date(version.data),
      input: parsed.data,
    });
    if (!result.ok) {
      if (result.reason === "duplicate") {
        return { status: "error", fieldErrors: { name: MESSAGES.duplicateName }, values };
      }
      const message =
        result.reason === "stale" ? MESSAGES.categoryStale : MESSAGES.categoryNotFound;
      return { status: "error", message, values };
    }
    if ("unchanged" in result) return { status: "success", message: MESSAGES.unchanged };
  } catch {
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  revalidatePath(budgetPath(auth.event.id));
  redirect(noticeUrl(auth.event.id, "category-saved", categoryId));
}

/**
 * Permanently removes an empty category, then opens the budget with a "removed" notice. A category
 * that still has items is refused and nothing is removed.
 */
export async function deleteCategoryAction(
  eventId: string,
  categoryId: string,
): Promise<DeleteFormState> {
  const auth = await authorizeEvent(eventId, "budget.manage", budgetPath(eventId));
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason] };
  if (!idSchema.safeParse(categoryId).success) {
    return { status: "error", message: MESSAGES.categoryNotFound };
  }
  try {
    const result = await removeCategory(budgetRepository(), {
      eventId: auth.event.id,
      categoryId,
      actorId: auth.user.id,
    });
    if (!result.ok) {
      return {
        status: "error",
        message:
          result.reason === "not-empty"
            ? MESSAGES.categoryHasItems(result.count)
            : MESSAGES.categoryNotFound,
      };
    }
  } catch {
    return { status: "error", message: MESSAGES.deleteFailed };
  }
  revalidatePath(budgetPath(auth.event.id));
  redirect(noticeUrl(auth.event.id, "category-removed"));
}

// ───────────────────────────── Items ─────────────────────────────

/** Adds an item to a category, then opens the budget with an "added" notice (B5-F02). */
export async function createItemAction(
  eventId: string,
  _previous: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const auth = await authorizeEvent(eventId, "budget.manage", budgetPath(eventId));
  const values = itemValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };

  const parsed = itemFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  let number: number;
  try {
    const result = await addItem(budgetRepository(), {
      eventId: auth.event.id,
      actorId: auth.user.id,
      input: parsed.data,
    });
    // Another event's category, a removed category, or a role change after the check above.
    if (!result.ok) return { status: "error", message: MESSAGES.categoryNotFound, values };
    number = result.number;
  } catch {
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  revalidatePath(budgetPath(auth.event.id));
  redirect(noticeUrl(auth.event.id, "item-added", formatBudgetItemReference(number)));
}

/**
 * Saves an item, including a move to another category of the same event, unless someone else saved
 * it first (D-032). Nothing changed: says so and records nothing.
 */
export async function updateItemAction(
  eventId: string,
  itemId: string,
  _previous: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const auth = await authorizeEvent(eventId, "budget.manage", budgetPath(eventId));
  const values = itemValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };
  if (!idSchema.safeParse(itemId).success) {
    return { status: "error", message: MESSAGES.itemNotFound, values };
  }
  const parsed = itemFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  const version = versionSchema.safeParse(formData.get("version"));
  if (!version.success) return { status: "error", message: MESSAGES.itemStale, values };

  let reference: string;
  try {
    const repository = budgetRepository();
    const current = await repository.findItem(auth.event.id, itemId);
    if (!current) return { status: "error", message: MESSAGES.itemNotFound, values };
    reference = formatBudgetItemReference(current.number);
    const result = await updateItem(repository, {
      eventId: auth.event.id,
      itemId,
      actorId: auth.user.id,
      version: new Date(version.data),
      input: parsed.data,
    });
    if (!result.ok) {
      const message = result.reason === "stale" ? MESSAGES.itemStale : MESSAGES.categoryNotFound;
      return { status: "error", message, values };
    }
    if ("unchanged" in result) return { status: "success", message: MESSAGES.unchanged };
  } catch {
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  revalidatePath(budgetPath(auth.event.id));
  redirect(noticeUrl(auth.event.id, "item-saved", reference));
}

/** Permanently removes an item, then opens the budget with a "removed" notice (B5-F02). */
export async function deleteItemAction(eventId: string, itemId: string): Promise<DeleteFormState> {
  const auth = await authorizeEvent(eventId, "budget.manage", budgetPath(eventId));
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason] };
  if (!idSchema.safeParse(itemId).success) {
    return { status: "error", message: MESSAGES.itemNotFound };
  }
  let number: number;
  try {
    const result = await removeItem(budgetRepository(), {
      eventId: auth.event.id,
      itemId,
      actorId: auth.user.id,
    });
    if (!result.ok) return { status: "error", message: MESSAGES.itemNotFound };
    number = result.number;
  } catch {
    return { status: "error", message: MESSAGES.deleteFailed };
  }
  revalidatePath(budgetPath(auth.event.id));
  redirect(noticeUrl(auth.event.id, "item-removed", formatBudgetItemReference(number)));
}