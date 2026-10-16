// src/modules/events/budget/application/add-item.ts
// Adds a budget item to a category of the same event (B5-F02; D-085). The repository looks the
// category up inside the event and issues the BUD- number in the same transaction.
import type { ItemInput } from "../schema";
import type { BudgetRepository } from "./ports";

export function addItem(
  repository: BudgetRepository,
  args: { eventId: string; actorId: string; input: ItemInput },
) {
  return repository.createItem(args);
}