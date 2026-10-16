// src/modules/events/budget/application/remove-item.ts
// Permanently removes a budget item (B5-F02; D-085). Its BUD- number is never reused.
import type { BudgetRepository } from "./ports";

export function removeItem(
  repository: BudgetRepository,
  args: { eventId: string; itemId: string; actorId: string },
) {
  return repository.deleteItem(args);
}