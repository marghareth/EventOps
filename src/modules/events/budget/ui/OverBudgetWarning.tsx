// src/modules/events/budget/ui/OverBudgetWarning.tsx
// The over-budget warning of the budget page (B5-F09, D-090). Shown only when something is over.
// It says which limit is exceeded and why, one line per reason, from budget-summary.ts: nothing is
// calculated or worded here. A polite status, not an interrupting alert: the page is not an
// emergency and this is not a separate alert engine (PROJECT_RULES section 2.2).
import { Banner } from "@/components/shared/Banner";
import type { OverBudgetWarning as Warning } from "../domain/budget-summary";

export function OverBudgetWarning({
  warnings,
  eventWithinBudget,
}: {
  warnings: readonly Warning[];
  /** True when the event's total committed is within its total allocated. */
  eventWithinBudget: boolean;
}) {
  if (warnings.length === 0) return null;
  const count = warnings.length;
  return (
    <Banner
      severity="critical"
      role="status"
      title={
        count === 1 ? "Over budget: 1 limit exceeded" : `Over budget: ${count} limits exceeded`
      }
    >
      <ul className="list-disc pl-5">
        {warnings.map((warning) => (
          <li key={warning.id ?? "event"}>{warning.message}</li>
        ))}
      </ul>
      <p className="mt-2">
        Judged on committed amounts, not estimates.
        {eventWithinBudget ? " The event as a whole is still within its total allocation." : ""}
      </p>
    </Banner>
  );
}