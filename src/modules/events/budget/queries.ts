// src/modules/events/budget/queries.ts
// Server-side budget reads for the pages (B5-F01, B5-F02; D-084, D-085). Every read authorizes on
// its own with authorizeEvent (D-036) and looks records up only inside the authorized event, so
// another event's category or item is "not found". Stored values only: no totals or statuses.
import "server-only";
import { z } from "zod";
import { authorizeEvent } from "@/modules/events/public";
import type { CategoryRecord, CategoryWithItems, ItemRecord } from "./application/ports";
import { budgetRepository } from "./composition";

const idSchema = z.uuid();
const budgetPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/budget`;

type Refused = { ok: false; reason: "not-found" | "forbidden" };

/** The whole budget for the list page. Every member may read; canManage drives the buttons. */
export async function getEventBudget(
  eventId: string,
): Promise<{ ok: true; categories: CategoryWithItems[]; canManage: boolean } | Refused> {
  const view = await authorizeEvent(eventId, "event.view", budgetPath(eventId));
  if (!view.ok) return { ok: false, reason: view.reason };
  const manage = await authorizeEvent(view.event.id, "budget.manage", budgetPath(view.event.id));
  const categories = await budgetRepository().listBudget(view.event.id);
  return { ok: true, categories, canManage: manage.ok };
}

/** One category for its edit form. Owners and Coordinators only. */
export async function getCategoryForEdit(
  eventId: string,
  categoryId: string,
): Promise<{ ok: true; category: CategoryRecord } | Refused> {
  const auth = await authorizeEvent(eventId, "budget.manage", budgetPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  if (!idSchema.safeParse(categoryId).success) return { ok: false, reason: "not-found" };
  const category = await budgetRepository().findCategory(auth.event.id, categoryId);
  return category ? { ok: true, category } : { ok: false, reason: "not-found" };
}

/**
 * What the item form needs: the event's categories for the picker and, when editing, the item.
 * Owners and Coordinators only. `itemId` omitted means "adding a new item".
 */
export async function getItemFormContext(
  eventId: string,
  itemId?: string,
): Promise<
  { ok: true; categories: { id: string; name: string }[]; item: ItemRecord | null } | Refused
> {
  const auth = await authorizeEvent(eventId, "budget.manage", budgetPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const repository = budgetRepository();
  let item: ItemRecord | null = null;
  if (itemId !== undefined) {
    if (!idSchema.safeParse(itemId).success) return { ok: false, reason: "not-found" };
    item = await repository.findItem(auth.event.id, itemId);
    if (!item) return { ok: false, reason: "not-found" };
  }
  const categories = (await repository.listBudget(auth.event.id)).map(({ id, name }) => ({
    id,
    name,
  }));
  return { ok: true, categories, item };
}