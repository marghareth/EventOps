// src/modules/events/budget/domain/budget-summary.ts
// The budget summary and the remaining budget (B5-F07, B5-F08; D-088). Deterministic domain rule,
// never AI, never stored (PROJECT_RULES sections 6, 6.1). The spent basis is COMMITTED:
// remaining = allocated - committed, for a category and for the whole event. Estimated and paid are
// shown beside it as information; estimated above the allocation raises no status (D-088).
// Arithmetic is whole centavos in BigInt, signed, never floating point. Pure: no database, no
// clock, safe for client components.
import { formatPesos } from "./budget.money";
import { fromCentavos, toCentavos, totalAllocated, totalsOf } from "./budget.totals";

/** The only two budget statuses (D-088). No others are invented. */
export const BUDGET_STATUSES = ["WITHIN_BUDGET", "OVER_BUDGET"] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

/** The wording for each status, kept in one place so no screen writes its own (D-088). */
export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  WITHIN_BUDGET: "Within budget",
  OVER_BUDGET: "Over budget",
};

export type BudgetSummary = {
  allocated: string;
  committed: string;
  /**
   * allocated - committed, signed, two places ("-250.00" when over). The signed value is for
   * calculation; screens show `overBy` instead of a negative remaining.
   */
  remaining: string;
  /** How much committed exceeds the allocation, or null when it does not. */
  overBy: string | null;
  status: BudgetStatus;
};

/**
 * Remaining and status for one allocation and one committed total (D-088):
 * - Within: committed <= allocated. Exactly equal is within, with 0.00 remaining.
 * - Over: committed > allocated, even by one centavo.
 * - A zero allocation is over as soon as anything is committed, and within at 0.00.
 */
export function summarizeBudget(input: { allocated: string; committed: string }): BudgetSummary {
  const difference = toCentavos(input.allocated) - toCentavos(input.committed);
  const over = difference < BigInt(0);
  const magnitude = fromCentavos(over ? -difference : difference);
  return {
    allocated: input.allocated,
    committed: input.committed,
    remaining: over ? `-${magnitude}` : magnitude,
    overBy: over ? magnitude : null,
    status: over ? "OVER_BUDGET" : "WITHIN_BUDGET",
  };
}

export type CategoryForSummary = {
  id: string;
  name: string;
  allocation: string;
  items: readonly { estimated: string; committed: string; paid: string }[];
};

export type EventBudgetSummary = {
  /** The event as a whole: total allocated against total committed (D-087, D-088). */
  event: BudgetSummary & { estimated: string; paid: string };
  /** One entry per category, in the order given, each reported on its own (D-088). */
  categories: ReadonlyArray<
    BudgetSummary & { id: string; name: string; estimated: string; paid: string }
  >;
};

/**
 * The summary of a whole event budget. A category can be over while the event is within, and the
 * reverse; each is judged against its own allocation. Reuses the D-086 and D-087 sums rather than
 * adding a second calculation.
 */
export function summarizeEventBudget(
  categories: readonly CategoryForSummary[],
): EventBudgetSummary {
  const eventTotals = totalsOf(categories.flatMap((category) => category.items));
  return {
    event: {
      ...summarizeBudget({
        allocated: totalAllocated(categories),
        committed: eventTotals.committed,
      }),
      estimated: eventTotals.estimated,
      paid: eventTotals.paid,
    },
    categories: categories.map((category) => {
      const totals = totalsOf(category.items);
      return {
        id: category.id,
        name: category.name,
        ...summarizeBudget({ allocated: category.allocation, committed: totals.committed }),
        estimated: totals.estimated,
        paid: totals.paid,
      };
    }),
  };
}

/** One reason the budget is over: which limit, how far over, and the plain-words explanation. */
export type OverBudgetWarning = {
  scope: "event" | "category";
  /** The category ID, or null for the event as a whole. */
  id: string | null;
  /** The category name, or "The event" for the event as a whole. */
  name: string;
  allocated: string;
  committed: string;
  overBy: string;
  /** Says what is over, the two amounts compared, and by how much (D-090). */
  message: string;
};

function warningFor(
  scope: OverBudgetWarning["scope"],
  id: string | null,
  name: string,
  summary: BudgetSummary,
): OverBudgetWarning | null {
  if (summary.overBy === null) return null;
  const committed = formatPesos(summary.committed);
  const overByText = formatPesos(summary.overBy);
  const limit =
    toCentavos(summary.allocated) === BigInt(0)
      ? "it has no allocation"
      : `its allocation is ${formatPesos(summary.allocated)}`;
  const message =
    scope === "event"
      ? `The event is over budget: ${committed} is committed against ${formatPesos(summary.allocated)} allocated in total, ${overByText} more.`
      : `${name} is over budget: ${committed} is committed and ${limit}, ${overByText} more.`;
  return {
    scope,
    id,
    name,
    allocated: summary.allocated,
    committed: summary.committed,
    overBy: summary.overBy,
    message,
  };
}

/**
 * The over-budget warnings of an event budget (B5-F09, D-090): the event first when its total
 * committed exceeds its total allocated, then each over category in the order given. Every warning
 * names the limit it is judged against and the basis (committed), so the user can see why. Empty
 * when nothing is over. Derived from the D-088 result, never stored, never AI.
 */
export function overBudgetWarnings(summary: EventBudgetSummary): OverBudgetWarning[] {
  return [
    warningFor("event", null, "The event", summary.event),
    ...summary.categories.map((category) =>
      warningFor("category", category.id, category.name, category),
    ),
  ].filter((warning): warning is OverBudgetWarning => warning !== null);
}