// src/modules/events/impact/domain/rules/seating-capacity.ts
// Seating capacity impact (B7-F04; D-101 point 3). Compares the proposed expected attendees with
// the venue capacity. Totals only: this is not a seating chart and assigns no tables.
//
//   no capacity set        → Info ("Set venue capacity to check seating")
//   proposed > capacity    → Critical (how many more than the venue holds)
//   proposed ≤ capacity    → Passed (exactly at capacity passes, with no room left)
//
// No "near capacity" warning (option 3b was not chosen). Pure.
import { describeChange, formatCount } from "../change-event";
import type { ImpactItem } from "../impact-item";
import type { RuleContext } from "../registry";

const NOT_A_CHART = "This compares totals only; it is not a seating chart.";

export function seatingCapacityRule({ state, change }: RuleContext): ImpactItem[] {
  const base = {
    key: "seating-capacity",
    area: "SEATING",
    basis: "ESTIMATE",
    assumptions: [],
    references: [],
  } as const;
  const proposed = formatCount(change.to);

  if (state.capacity === null) {
    return [
      {
        ...base,
        severity: "INFO",
        title: "Seating not checked",
        reason: `The event has no venue capacity, so ${proposed} expected attendees can't be compared with it.`,
        fix: { target: "settings", label: "Set the venue capacity" },
      },
    ];
  }

  const capacity = formatCount(state.capacity);
  const over = change.to - state.capacity;
  if (over > 0) {
    return [
      {
        ...base,
        severity: "CRITICAL",
        title: `${formatCount(over)} more ${over === 1 ? "person" : "people"} than the venue holds`,
        reason: `${proposed} expected attendees (${describeChange(change)}) against a venue capacity of ${capacity}. ${NOT_A_CHART}`,
        fix: { target: "settings", label: "Review the venue capacity" },
      },
    ];
  }

  const room = -over;
  return [
    {
      ...base,
      severity: "PASSED",
      title: `${proposed} expected attendees fit the venue`,
      reason:
        room === 0
          ? `The venue capacity is ${capacity}: exactly full, with no room for more. ${NOT_A_CHART}`
          : `The venue capacity is ${capacity}, leaving room for ${formatCount(room)} more. ${NOT_A_CHART}`,
      fix: null,
    },
  ];
}