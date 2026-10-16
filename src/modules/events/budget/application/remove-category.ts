// src/modules/events/budget/application/remove-category.ts
// Permanently removes an EMPTY category (B5-F01; D-084). A category with items is refused; the
// repository checks again inside its transaction and the foreign key backs that up.
import type { BudgetRepository } from "./ports";

export function removeCategory(
  repository: BudgetRepository,
  args: { eventId: string; categoryId: string; actorId: string },
) {
  return repository.deleteCategory(args);
}