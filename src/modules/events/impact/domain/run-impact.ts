// src/modules/events/impact/domain/run-impact.ts
// The Impact Engine (B7-F01, B7-F08, B7-F10; D-101). Deterministic: the same state, change and
// assumptions always give the same result, in the same order. It reads nothing and writes nothing:
// it never changes the event, never decides who may do what, and never uses AI (PROJECT_RULES
// section 10). The result is a simulation, not a fact about the event.
import type { ImpactAssumptions } from "./assumptions";
import { attendanceDelta, type ExpectedAttendanceChange } from "./change-event";
import type { EventState } from "./event-state";
import {
  countBySeverity,
  sortImpacts,
  worstSeverity,
  type ImpactItem,
  type ImpactSeverity,
} from "./impact-item";
import { IMPACT_RULES, type BudgetTools } from "./registry";
import { estimateCatering } from "./rules/catering-cost";

export type ImpactResult = {
  change: ExpectedAttendanceChange;
  /** True when the proposed value equals the stored one: nothing is analyzed. */
  noChange: boolean;
  /** The most serious severity found, or null when nothing was analyzed. */
  overall: ImpactSeverity | null;
  counts: Record<ImpactSeverity, number>;
  /** Most serious first. */
  items: ImpactItem[];
};

export function runImpact(
  state: EventState,
  change: ExpectedAttendanceChange,
  assumptions: ImpactAssumptions,
  tools: BudgetTools,
): ImpactResult {
  if (change.from !== state.expectedAttendees) {
    // The change must start from the stored value; anything else is a programming error.
    throw new Error("The change does not start from the event's expected attendees.");
  }
  if (change.to === change.from) {
    return { change, noChange: true, overall: null, counts: countBySeverity([]), items: [] };
  }
  const catering = estimateCatering(
    attendanceDelta(change),
    assumptions.cateringCostPerHead,
    tools,
  );
  const items = sortImpacts(
    IMPACT_RULES.flatMap((rule) => rule({ state, change, assumptions, tools, catering })),
  );
  return {
    change,
    noChange: false,
    overall: worstSeverity(items.map((item) => item.severity)),
    counts: countBySeverity(items),
    items,
  };
}