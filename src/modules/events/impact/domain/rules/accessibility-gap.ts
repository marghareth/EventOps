// src/modules/events/impact/domain/rules/accessibility-gap.ts
// Accessibility gap impact (B7-F05; D-101 point 4, D-102). Two parts:
//
// 1. RECORDED. The gaps Batch 3 already found from guests' recorded needs and the event's resources
//    (D-062 to D-066). A planning number changes no one's needs, so each gap alert is reported as
//    still unresolved, at the severity Batch 3 gave it: critical → Critical, warning → Needs
//    attention. No alerts → Passed. Batch 3's rules are reused, never re-derived here.
// 2. ESTIMATE. With "accessible seats per 100 guests" set: seats needed = proposed × ratio ÷ 100,
//    rounded up, against the accessible seats recorded as Available. Short → Needs attention;
//    enough → Passed. Not set → Info, and no estimate. Pure.
import { ASSUMPTION_LABEL, estimateAccessibleSeats, formatRatio } from "../assumptions";
import { formatCount } from "../change-event";
import type { ImpactItem } from "../impact-item";
import type { RuleContext } from "../registry";

const SEVERITY = { critical: "CRITICAL", warning: "NEEDS_ATTENTION" } as const;
const seats = (n: number) => `${formatCount(n)} accessible ${n === 1 ? "seat" : "seats"}`;

function recordedGaps({ state }: RuleContext): ImpactItem[] {
  const { alerts } = state.accessibility;
  if (alerts.length === 0) {
    return [
      {
        key: "accessibility-gaps",
        area: "ACCESSIBILITY",
        severity: "PASSED",
        title: "No unresolved accessibility gaps",
        reason: "No accessibility gap is recorded for this event's guests and resources.",
        basis: "RECORDED",
        assumptions: [],
        fix: null,
        references: [],
      },
    ];
  }
  return alerts.map((alert) => ({
    key: `accessibility:${alert.key}`,
    area: "ACCESSIBILITY",
    severity: SEVERITY[alert.severity],
    title: `Still unresolved: ${alert.title}`,
    reason: `${alert.reason} Changing the expected attendees doesn't resolve it.`,
    basis: "RECORDED",
    assumptions: [],
    fix: { target: "accessibility", label: "Open Accessibility" },
    references: [],
  }));
}

function seatEstimate({ state, change, assumptions }: RuleContext): ImpactItem {
  const base = { key: "accessibility-seats-estimate", area: "ACCESSIBILITY", references: [] } as const;
  const ratio = assumptions.accessibleSeatsPer100;
  const proposed = formatCount(change.to);
  if (ratio === null) {
    return {
      ...base,
      severity: "INFO",
      title: "Accessible seats not estimated",
      reason: `No accessible seats per 100 guests is set, so the need for ${proposed} expected attendees isn't estimated. Needs recorded on the guest list are still checked.`,
      basis: "ESTIMATE",
      assumptions: [{ label: ASSUMPTION_LABEL.accessibleSeatsPer100, value: "Not set" }],
      fix: { target: "assumptions", label: "Set accessible seats per 100 guests" },
    };
  }

  const needed = estimateAccessibleSeats(change.to, ratio);
  const { seatsAvailable, seatsRecordedNeeds } = state.accessibility;
  const used = [{ label: ASSUMPTION_LABEL.accessibleSeatsPer100, value: formatRatio(ratio) }];
  const recorded = `The guest list records ${formatCount(seatsRecordedNeeds)} Required accessible-seating ${seatsRecordedNeeds === 1 ? "need" : "needs"}.`;
  const basis = `At ${formatRatio(ratio)} per 100 guests, ${proposed} expected attendees need about ${seats(needed)}; ${formatCount(seatsAvailable)} ${seatsAvailable === 1 ? "is" : "are"} available.`;
  const short = needed - seatsAvailable;
  if (short > 0) {
    return {
      ...base,
      severity: "NEEDS_ATTENTION",
      title: `About ${formatCount(short)} more accessible ${short === 1 ? "seat" : "seats"} may be needed`,
      reason: `${basis} This is an estimate. ${recorded}`,
      basis: "ESTIMATE",
      assumptions: used,
      fix: { target: "accessibility", label: "Review accessible seating" },
    };
  }
  return {
    ...base,
    severity: "PASSED",
    title: "Accessible seats look sufficient",
    reason: `${basis} This is an estimate. ${recorded}`,
    basis: "ESTIMATE",
    assumptions: used,
    fix: null,
  };
}

export function accessibilityGapRule(context: RuleContext): ImpactItem[] {
  return [...recordedGaps(context), seatEstimate(context)];
}