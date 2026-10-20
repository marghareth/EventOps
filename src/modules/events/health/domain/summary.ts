// src/modules/events/health/domain/summary.ts
// The dashboard's operational summaries (B8-F11; D-107): one line of facts per area, from the same
// state the checks read. Pure; nothing is recalculated beyond counting.
import { count } from "./health-check";
import type { HealthState } from "./health-state";

export type DashboardSummary = {
  area: "ATTENDEES" | "SUPPLIERS" | "BUDGET" | "ACCESSIBILITY" | "TASKS";
  /** The main figure, for example "182 of 180". */
  figure: string;
  /** What the figure means, for example "confirmed of expected". */
  caption: string;
  target: "attendees" | "suppliers" | "budget" | "accessibility" | "tasks";
};

export function dashboardSummary(
  state: HealthState,
  accessibilityLabel: string,
): DashboardSummary[] {
  const open = state.tasks.filter((t) => !t.done);
  const overdue = state.tasks.filter((t) => t.overdue).length;
  const confirmed = state.suppliers.filter((s) => s.confirmed).length;
  return [
    {
      area: "ATTENDEES",
      figure: `${state.confirmedHeadcount.toLocaleString("en-US")} of ${state.expectedAttendees.toLocaleString("en-US")}`,
      caption: "confirmed people of expected attendees",
      target: "attendees",
    },
    {
      area: "SUPPLIERS",
      figure: `${confirmed} of ${state.suppliers.length}`,
      caption: "suppliers confirmed",
      target: "suppliers",
    },
    {
      area: "BUDGET",
      figure: !state.budget.hasCategories
        ? "Not set up"
        : (state.budget.remainingText ?? "Over budget"),
      caption: !state.budget.hasCategories
        ? "no budget categories yet"
        : state.budget.remainingText === null
          ? "committed is above the total allocation"
          : `left of ${state.budget.allocatedText}`,
      target: "budget",
    },
    {
      area: "ACCESSIBILITY",
      figure: accessibilityLabel,
      caption: "accessibility readiness",
      target: "accessibility",
    },
    {
      area: "TASKS",
      figure: `${open.length} open`,
      caption: overdue > 0 ? `${count(overdue, "is", "are")} overdue` : "none overdue",
      target: "tasks",
    },
  ];
}