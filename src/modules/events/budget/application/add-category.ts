// src/modules/events/budget/application/add-category.ts
// Adds a budget category (B5-F01; D-084). The caller has already authorized the actor.
import type { CategoryInput } from "../schema";
import type { BudgetRepository } from "./ports";

export function addCategory(
  repository: BudgetRepository,
  args: { eventId: string; actorId: string; input: CategoryInput },
) {
  return repository.createCategory(args);
}