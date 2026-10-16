// src/modules/events/budget/application/update-category.ts
// Saves a category's name and allocation (B5-F01; D-084). A save that changes nothing is reported
// as "unchanged" and writes nothing, not even an audit entry. The repository refuses a stale save.
import { BUDGET_CATEGORY_CHANGE_FIELDS } from "../domain/budget.category";
import { diffFields, hasChanges } from "../domain/budget.changes";
import type { CategoryInput } from "../schema";
import type { BudgetRepository } from "./ports";

export async function updateCategory(
  repository: BudgetRepository,
  args: {
    eventId: string;
    categoryId: string;
    actorId: string;
    version: Date;
    input: CategoryInput;
  },
) {
  const current = await repository.findCategory(args.eventId, args.categoryId);
  if (!current) return { ok: false, reason: "not-found" } as const;

  const changes = diffFields(
    BUDGET_CATEGORY_CHANGE_FIELDS,
    { name: current.name, allocation: current.allocation },
    { name: args.input.name, allocation: args.input.allocation },
  );
  if (!hasChanges(changes)) return { ok: true, unchanged: true } as const;
  return repository.updateCategory({ ...args, changes });
}