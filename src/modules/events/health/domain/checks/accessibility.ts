// src/modules/events/health/domain/checks/accessibility.ts
// Accessibility health (B8-F05; D-105, check X1). Pure. Uses Batch 3's readiness status (D-063) and
// its gap alerts (D-066) as they are:
//   Not ready → Critical · Almost ready → Needs attention · Ready → Passed
//   No required needs → Passed when there are guests; Not checked while the guest list is empty.
import type { HealthCheckResult } from "../health-check";
import { count } from "../health-check";
import type { HealthState } from "../health-state";

const LABEL = "Guests' accessibility needs are covered";
const fix = { target: "accessibility", label: "Open Accessibility" } as const;

export function accessibilityChecks(state: HealthState): HealthCheckResult[] {
  const { status, alerts } = state.accessibility;
  const base = {
    id: "accessibility.readiness",
    area: "ACCESSIBILITY" as const,
    label: LABEL,
    references: [],
  };
  const gaps = alerts.map((a) => a.title).join("; ");
  switch (status) {
    case "NOT_READY":
      return [
        {
          ...base,
          outcome: "CRITICAL",
          summary: "Accessibility is Not ready",
          reason: `Required needs are not covered: ${gaps || "see Accessibility"}.`,
          fix,
        },
      ];
    case "ALMOST_READY":
      return [
        {
          ...base,
          outcome: "NEEDS_ATTENTION",
          summary: "Accessibility is Almost ready",
          reason: `${count(alerts.length, "need is", "needs are")} still being arranged or must be checked by hand: ${gaps || "see Accessibility"}.`,
          fix,
        },
      ];
    case "READY":
      return [
        {
          ...base,
          outcome: "PASSED",
          summary: "Accessibility is Ready",
          reason:
            "Every Required need recorded for the guests is covered by the event's resources.",
          fix: null,
        },
      ];
    case "NO_REQUIRED_NEEDS":
      return [
        state.attendees.length === 0
          ? {
              ...base,
              outcome: "NOT_CHECKED",
              summary: "No guests yet",
              reason: "There are no guests on the list yet, so their needs can't be checked.",
              fix: null,
            }
          : {
              ...base,
              outcome: "PASSED",
              summary: "No Required needs recorded",
              reason: "No guest has a Required accessibility need recorded.",
              fix: null,
            },
      ];
  }
}