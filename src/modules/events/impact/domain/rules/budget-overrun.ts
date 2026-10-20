// src/modules/events/impact/domain/rules/budget-overrun.ts
// Budget overrun impact (B7-F06; D-101 point 5, D-102). Uses the budget context's own rule (D-088,
// basis COMMITTED) through BudgetTools; nothing here decides "over" on its own.
//
//   projected committed = committed + the estimated catering INCREASE (B7-F03)
//
// judged for the whole event and, when a catering budget category is chosen, for that category.
//   already over before the change → Critical ("already over")
//   pushed over by the change      → Critical
//   within                         → Passed
// An estimated DECREASE is not subtracted (committed money is already agreed), and with no cost per
// head the check shows the budget as it stands and says the catering change isn't included.
// No budget categories → Info. A chosen category that no longer exists → Info. Pure.
import { ASSUMPTION_LABEL } from "../assumptions";
import type { BudgetStateCategory } from "../event-state";
import type { ImpactAssumptionUsed, ImpactItem } from "../impact-item";
import type { BudgetCheck, RuleContext } from "../registry";

/** Not a real category: carries the projected increase when no catering category is chosen. */
const PROJECTION_ID = "impact-projection";

export function budgetOverrunRule({
  state,
  assumptions,
  catering,
  tools,
}: RuleContext): ImpactItem[] {
  const pesos = tools.formatPesos;
  const categories = state.budget;
  const used: ImpactAssumptionUsed[] = [
    {
      label: ASSUMPTION_LABEL.cateringCostPerHead,
      value: catering.status === "ESTIMATED" ? pesos(catering.costPerHead) : "Not set",
    },
  ];

  if (categories.length === 0) {
    return [
      {
        key: "budget-overrun",
        area: "BUDGET",
        severity: "INFO",
        title: "Budget not checked",
        reason: "This event has no budget categories yet, so there is no limit to check against.",
        basis: "RECORDED",
        assumptions: used,
        fix: { target: "budget", label: "Set up the budget" },
        references: [],
      },
    ];
  }

  const chosenId = assumptions.cateringCategoryId;
  const chosen = chosenId ? (categories.find((c) => c.id === chosenId) ?? null) : null;
  used.push({
    label: ASSUMPTION_LABEL.cateringCategoryId,
    value: chosenId === null ? "Not set" : chosen ? chosen.name : "Not found",
  });

  const increase =
    catering.status === "ESTIMATED" && catering.direction === "INCREASE" ? catering.amount : null;

  const projected: BudgetStateCategory[] = categories.map((c) =>
    increase !== null && chosen && c.id === chosen.id
      ? { ...c, items: [...c.items, { estimated: "0.00", committed: increase, paid: "0.00" }] }
      : c,
  );
  if (increase !== null && !chosen) {
    projected.push({
      id: PROJECTION_ID,
      name: "",
      allocation: "0.00",
      items: [{ estimated: "0.00", committed: increase, paid: "0.00" }],
    });
  }

  const now = tools.summarizeEventBudget(categories);
  const next = tools.summarizeEventBudget(projected);

  const note = (() => {
    if (increase !== null) return ` after the estimated catering increase of ${pesos(increase)}`;
    if (catering.status === "NOT_SET") {
      return ". The catering change isn't included: no cost per head is set";
    }
    if (catering.direction === "DECREASE") {
      return ". An estimated decrease isn't subtracted: committed amounts are already agreed";
    }
    return "";
  })();

  const judge = (
    key: string,
    scope: string,
    before: BudgetCheck,
    after: BudgetCheck,
  ): ImpactItem => {
    const base = {
      key,
      area: "BUDGET",
      basis: increase !== null ? "ESTIMATE" : "RECORDED",
      assumptions: used,
      references: [],
    } as const;
    if (before.overBy !== null) {
      const worse =
        increase !== null && after.overBy !== null
          ? ` The estimated catering increase of ${pesos(increase)} would make it ${pesos(after.overBy)} over.`
          : "";
      return {
        ...base,
        severity: "CRITICAL",
        title: `${scope} is already over budget`,
        reason: `${pesos(before.committed)} is committed against ${pesos(before.allocated)} allocated, ${pesos(before.overBy)} over, before this change.${worse}`,
        fix: { target: "budget", label: "Open the budget" },
      };
    }
    if (after.overBy !== null && increase !== null) {
      return {
        ...base,
        severity: "CRITICAL",
        title: `${scope} may go over budget by ${pesos(after.overBy)}`,
        reason: `${pesos(before.committed)} committed plus the estimated catering increase of ${pesos(increase)} is ${pesos(after.committed)}, against ${pesos(after.allocated)} allocated. The budget's rule compares committed amounts with the allocation.`,
        fix: { target: "budget", label: "Open the budget" },
      };
    }
    return {
      ...base,
      severity: "PASSED",
      title: `${scope} stays within budget`,
      reason: `${pesos(after.remaining)} of ${pesos(after.allocated)} allocated remains${note}.`,
      fix: null,
    };
  };

  const items = [judge("budget-overrun", "The event", now.event, next.event)];

  if (chosenId !== null && !chosen) {
    items.push({
      key: "budget-category-missing",
      area: "BUDGET",
      severity: "INFO",
      title: "Catering budget category not found",
      reason:
        "The category chosen in the assumptions no longer exists. Choose another to check it.",
      basis: "RECORDED",
      assumptions: used,
      fix: { target: "assumptions", label: "Choose a catering category" },
      references: [],
    });
  } else if (chosen) {
    const before = now.categories.find((c) => c.id === chosen.id);
    const after = next.categories.find((c) => c.id === chosen.id);
    if (before && after) {
      items.push(judge("budget-overrun:category", `“${chosen.name}”`, before, after));
    }
  }
  return items;
}