// src/modules/events/impact/domain/registry.ts
// The impact rules Batch 7 runs, in order (D-101), and what each rule is given. Rules are small pure
// functions; each returns zero or more items. Transport and volunteer rules are not registered: they
// need approval first (PROJECT_RULES section 10, DECISIONS open item 2).
//
// The budget's own rules (D-086 to D-088) and peso helpers are passed in as BudgetTools by the
// application layer, so the over-budget check is the budget context's calculation, not a copy.
import type { ImpactAssumptions } from "./assumptions";
import type { ExpectedAttendanceChange } from "./change-event";
import type { BudgetStateCategory, EventState } from "./event-state";
import type { ImpactItem } from "./impact-item";
import { accessibilityGapRule } from "./rules/accessibility-gap";
import { budgetOverrunRule } from "./rules/budget-overrun";
import { cateringCostRule, type CateringEstimate } from "./rules/catering-cost";
import { seatingCapacityRule } from "./rules/seating-capacity";
import { taskReviewRule } from "./rules/task-review";

/** One budget limit judged by the budget context (D-088). */
export type BudgetCheck = {
  allocated: string;
  committed: string;
  remaining: string;
  overBy: string | null;
  status: "WITHIN_BUDGET" | "OVER_BUDGET";
};

export type BudgetTools = {
  /** The budget context's summarizeEventBudget (D-086 to D-088). */
  summarizeEventBudget(categories: readonly BudgetStateCategory[]): {
    event: BudgetCheck;
    categories: ReadonlyArray<BudgetCheck & { id: string; name: string }>;
  };
  /** "12000.00" → "₱12,000.00". */
  formatPesos(value: string): string;
  /** Exact peso string ↔ whole centavos (the budget's representation). */
  toCentavos(value: string): bigint;
  fromCentavos(value: bigint): string;
};

export type RuleContext = {
  state: EventState;
  change: ExpectedAttendanceChange;
  assumptions: ImpactAssumptions;
  tools: BudgetTools;
  /** The catering estimate, worked out once and shared with the budget rule. */
  catering: CateringEstimate;
};

export type ImpactRule = (context: RuleContext) => ImpactItem[];

export const IMPACT_RULES: readonly ImpactRule[] = [
  seatingCapacityRule,
  cateringCostRule,
  budgetOverrunRule,
  accessibilityGapRule,
  taskReviewRule,
];