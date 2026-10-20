// src/modules/events/health/domain/score.ts
// Event Health score and status (B8-F07, B8-F08, B8-F09, B8-F12; D-106). Deterministic, never AI.
//
//   score  = passed checks ÷ checks evaluated × 100, rounded DOWN to a whole percent (3a)
//            "Not checked" is left out; with nothing evaluated there is no score.
//   status = At risk if any check is Critical; otherwise Needs attention if any is; otherwise Ready
//            (4a: from severities, never from the score). No status while nothing is evaluated.
import {
  HEALTH_AREAS,
  outcomeRank,
  type HealthCheckResult,
  type HealthOutcome,
} from "./health-check";
import type { HealthState } from "./health-state";
import { HEALTH_CHECK_COUNT, HEALTH_CHECK_GROUPS } from "./registry";

export const HEALTH_STATUSES = ["AT_RISK", "NEEDS_ATTENTION", "READY"] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  AT_RISK: "At risk",
  NEEDS_ATTENTION: "Needs attention",
  READY: "Ready",
};

export type HealthReport = {
  /** Every check, in the fixed order. */
  checks: HealthCheckResult[];
  counts: Record<HealthOutcome, number>;
  /** Passed ÷ evaluated, whole percent rounded down; null when nothing could be evaluated. */
  score: { percent: number; passed: number; evaluated: number } | null;
  status: HealthStatus | null;
  /** Critical then Needs attention; within a severity, the check order (B8-F09, B8-F12). */
  issues: HealthCheckResult[];
};

export function healthScore(checks: readonly HealthCheckResult[]): HealthReport["score"] {
  const evaluated = checks.filter((c) => c.outcome !== "NOT_CHECKED").length;
  if (evaluated === 0) return null;
  const passed = checks.filter((c) => c.outcome === "PASSED").length;
  return { percent: Math.floor((passed * 100) / evaluated), passed, evaluated };
}

export function healthStatus(checks: readonly HealthCheckResult[]): HealthStatus | null {
  if (checks.every((c) => c.outcome === "NOT_CHECKED")) return null;
  if (checks.some((c) => c.outcome === "CRITICAL")) return "AT_RISK";
  if (checks.some((c) => c.outcome === "NEEDS_ATTENTION")) return "NEEDS_ATTENTION";
  return "READY";
}

export function evaluateHealth(state: HealthState): HealthReport {
  const checks = HEALTH_CHECK_GROUPS.flatMap((group) => group(state));
  if (checks.length !== HEALTH_CHECK_COUNT) {
    throw new Error(`Expected ${HEALTH_CHECK_COUNT} health checks, got ${checks.length}.`);
  }
  const counts: Record<HealthOutcome, number> = {
    CRITICAL: 0,
    NEEDS_ATTENTION: 0,
    PASSED: 0,
    NOT_CHECKED: 0,
  };
  for (const check of checks) counts[check.outcome] += 1;
  const issues = checks
    .map((check, index) => ({ check, index }))
    .filter(({ check }) => check.outcome === "CRITICAL" || check.outcome === "NEEDS_ATTENTION")
    .sort(
      (a, b) =>
        outcomeRank(a.check.outcome) - outcomeRank(b.check.outcome) ||
        HEALTH_AREAS.indexOf(a.check.area) - HEALTH_AREAS.indexOf(b.check.area) ||
        a.index - b.index,
    )
    .map(({ check }) => check);
  return { checks, counts, score: healthScore(checks), status: healthStatus(checks), issues };
}