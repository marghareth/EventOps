// src/modules/events/budget/domain/budget.category.ts
// Budget category rules that need no database (B5-F01; D-084).

export const BUDGET_CATEGORY_NAME_MAX = 120;

/** The editable category fields, in the order they are listed in the audit entry. */
export const BUDGET_CATEGORY_CHANGE_FIELDS = ["name", "allocation"] as const;