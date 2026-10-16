// src/modules/events/budget/form-state.ts
// What the budget server actions return to the forms, and every message they show (B5-F01, B5-F02).
// Kept apart from actions.ts because a "use server" file may only export async functions.
import type { CategoryField, ItemField } from "./schema";

export type CategoryFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<CategoryField, string>>;
      values: Record<CategoryField, string>;
    };

export type ItemFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<ItemField, string>>;
      values: Record<ItemField, string>;
    };

export type DeleteFormState = { status: "idle" } | { status: "error"; message: string };

export const BUDGET_MESSAGES = {
  eventNotFound: "We couldn't find this event.",
  forbidden: "Only Owners and Coordinators can change the budget.",
  duplicateName: "This event already has a category with that name.",
  categoryNotFound: "That category no longer exists. Go back to the budget and try again.",
  categoryStale:
    "Someone else changed this category while you were editing. Reopen it to see the latest values.",
  itemNotFound: "That budget item no longer exists. Go back to the budget and try again.",
  itemStale:
    "Someone else changed this item while you were editing. Reopen it to see the latest values.",
  unchanged: "Nothing changed, so nothing was saved.",
  saveFailed: "We couldn't save your changes. Nothing was saved. Try again in a moment.",
  deleteFailed: "We couldn't delete it. Nothing was removed. Try again in a moment.",
  categoryHasItems: (count: number) =>
    count === 1
      ? "This category still has 1 item. Move or delete it first."
      : `This category still has ${count} items. Move or delete them first.`,
} as const;