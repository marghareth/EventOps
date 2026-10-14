// src/modules/events/accessibility/domain/readiness-status.ts
// The event's accessibility readiness status (B3-08, D-063): the canonical list and the one rule
// that derives it from coverage (domain/readiness.ts). Documented in docs/DATA_MODEL.md ("Readiness
// status") and changed there first. Pure; never stored, so it can't be set by hand. The UI and the
// server both use these definitions.
import type { Coverage, CoverageState } from "./readiness";

/** In the order the rule checks them. */
export const READINESS_STATUSES = [
  "NO_REQUIRED_NEEDS",
  "NOT_READY",
  "ALMOST_READY",
  "READY",
] as const;
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export type ReadinessSeverity = "info" | "critical" | "warning" | "success";

export const READINESS_STATUS_DEFINITIONS: Record<
  ReadinessStatus,
  { label: string; description: string; severity: ReadinessSeverity }
> = {
  NO_REQUIRED_NEEDS: {
    label: "No required needs",
    description:
      "No guest who is coming has a Required accessibility need, so nothing decides readiness yet.",
    severity: "info",
  },
  NOT_READY: {
    label: "Not ready",
    description: "At least one Required need has no resource in place, or not enough seats.",
    severity: "critical",
  },
  ALMOST_READY: {
    label: "Almost ready",
    description:
      "Nothing is missing, but some resources are still being arranged or some needs must be checked by hand.",
    severity: "warning",
  },
  READY: {
    label: "Ready",
    description: "Every Required need of guests who are coming is covered.",
    severity: "success",
  },
};

/** How many deciding needs are in each state: the facts behind the status. */
export type DecidingCounts = Record<CoverageState, number> & { total: number };

export function decidingCounts(coverage: Coverage): DecidingCounts {
  const counts: DecidingCounts = {
    total: 0,
    covered: 0,
    arranging: 0,
    "check-by-hand": 0,
    missing: 0,
    short: 0,
  };
  for (const item of coverage.requirements) {
    if (item.role !== "decides") continue;
    counts.total += 1;
    counts[item.state] += 1;
  }
  return counts;
}

/** The event's status, from the needs that decide readiness only (D-063). */
export function readinessStatus(coverage: Coverage): ReadinessStatus {
  const counts = decidingCounts(coverage);
  if (counts.total === 0) return "NO_REQUIRED_NEEDS";
  if (counts.missing > 0 || counts.short > 0) return "NOT_READY";
  if (counts.arranging > 0 || counts["check-by-hand"] > 0) return "ALMOST_READY";
  return "READY";
}