// src/modules/events/budget/domain/budget.item.ts
// Budget item rules that need no database (B5-F02; D-085): the readable ID, the field limits and
// the list of fields an edit can change. Nothing derived (totals, remaining, status) lives here:
// those rules are not approved yet (PROJECT_RULES section 6.1).

export const BUDGET_ITEM_NAME_MAX = 120;
export const BUDGET_ITEM_NOTES_MAX = 2000;

const REFERENCE_PATTERN = /^BUD-\d{4,}$/;

/** 4 → "BUD-0004". Numbers are issued per event and never reused (D-085). */
export function formatBudgetItemReference(number: number): string {
  return `BUD-${String(number).padStart(4, "0")}`;
}

/** True for a well-formed readable ID such as "BUD-0004". Used to trust a ?ref= value in the URL. */
export function isBudgetItemReference(value: string | undefined): value is string {
  return typeof value === "string" && REFERENCE_PATTERN.test(value);
}

/** The editable item fields, in the order they are listed in the audit entry. */
export const BUDGET_ITEM_CHANGE_FIELDS = [
  "categoryId",
  "name",
  "estimated",
  "committed",
  "paid",
  "notes",
] as const;