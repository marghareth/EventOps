// src/modules/events/impact/application/budget-tools.ts
// The budget context's own rules, handed to the pure impact rules (D-101). Reused through the
// budget's public interface, so "over budget" means exactly what it means on the Budget page (D-088).
import {
  formatPesos,
  fromCentavos,
  summarizeEventBudget,
  toCentavos,
} from "@/modules/events/budget/public";
import type { BudgetTools } from "../domain/registry";

export const budgetTools: BudgetTools = {
  summarizeEventBudget: (categories) => summarizeEventBudget(categories),
  formatPesos,
  toCentavos,
  fromCentavos,
};