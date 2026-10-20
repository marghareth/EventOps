// src/modules/events/health/domain/checks/budget.ts
// Budget health (B8-F04; D-105, checks B1 and B2). Pure. Uses the budget's own over-budget result
// and wording (D-088, D-090); nothing is recalculated here.
//   B1 the event is within its total allocation   over → Critical
//   B2 every category is within its allocation    any over → Critical
// Both are Not checked while the event has no budget categories.
import type { HealthCheckResult } from "../health-check";
import { count } from "../health-check";
import type { HealthState } from "../health-state";

const fix = { target: "budget", label: "Open the budget" } as const;

export function budgetChecks(state: HealthState): HealthCheckResult[] {
  const { budget } = state;
  const base = (id: string, label: string) => ({ id, area: "BUDGET" as const, label });
  if (!budget.hasCategories) {
    const reason = "The event has no budget categories yet, so there is no limit to check against.";
    const setUp = { target: "budget", label: "Set up the budget" } as const;
    return [
      {
        ...base("budget.event", "The event is within its total budget"),
        outcome: "NOT_CHECKED",
        summary: "No budget yet",
        reason,
        references: [],
        fix: setUp,
      },
      {
        ...base("budget.categories", "Every budget category is within its allocation"),
        outcome: "NOT_CHECKED",
        summary: "No budget yet",
        reason,
        references: [],
        fix: setUp,
      },
    ];
  }
  const event = budget.warnings.find((w) => w.scope === "event");
  const categories = budget.warnings.filter((w) => w.scope === "category");
  return [
    event
      ? {
          ...base("budget.event", "The event is within its total budget"),
          outcome: "CRITICAL",
          summary: "The event is over budget",
          reason: `${event.message} Judged on committed amounts.`,
          references: [],
          fix,
        }
      : {
          ...base("budget.event", "The event is within its total budget"),
          outcome: "PASSED",
          summary: "Within budget",
          reason: `${budget.remainingText ?? "₱0.00"} of ${budget.allocatedText} allocated remains, judged on committed amounts.`,
          references: [],
          fix: null,
        },
    categories.length > 0
      ? {
          ...base("budget.categories", "Every budget category is within its allocation"),
          outcome: "CRITICAL",
          summary: `${count(categories.length, "category is", "categories are")} over budget`,
          reason: categories.map((c) => c.message).join(" "),
          references: [],
          fix,
        }
      : {
          ...base("budget.categories", "Every budget category is within its allocation"),
          outcome: "PASSED",
          summary: "Every category within its allocation",
          reason: "No category's committed amount is above its allocation.",
          references: [],
          fix: null,
        },
  ];
}