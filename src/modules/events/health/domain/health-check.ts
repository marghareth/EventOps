// src/modules/events/health/domain/health-check.ts
// One Event Health check and its result (B8-F01, B8-F09, B8-F10; D-105). Pure. Each check is one of
// a fixed list and counts once in the score, however many records it is about.

/** Most serious first. NOT_CHECKED: nothing to check yet; shown, but left out of the score. */
export const HEALTH_OUTCOMES = ["CRITICAL", "NEEDS_ATTENTION", "PASSED", "NOT_CHECKED"] as const;
export type HealthOutcome = (typeof HEALTH_OUTCOMES)[number];

export const HEALTH_OUTCOME_LABEL: Record<HealthOutcome, string> = {
  CRITICAL: "Critical",
  NEEDS_ATTENTION: "Needs attention",
  PASSED: "Passed",
  NOT_CHECKED: "Not checked",
};

export const HEALTH_AREAS = ["ATTENDEES", "SUPPLIERS", "BUDGET", "ACCESSIBILITY", "TASKS"] as const;
export type HealthArea = (typeof HEALTH_AREAS)[number];

export const HEALTH_AREA_LABEL: Record<HealthArea, string> = {
  ATTENDEES: "Attendees",
  SUPPLIERS: "Suppliers",
  BUDGET: "Budget",
  ACCESSIBILITY: "Accessibility",
  TASKS: "Tasks",
};

/** The event section that fixes an issue. The page turns it into a link. */
export type HealthFixTarget =
  "attendees" | "suppliers" | "budget" | "accessibility" | "tasks" | "settings";

export type HealthCheckResult = {
  /** Stable, for example "attendees.rsvp". */
  id: string;
  area: HealthArea;
  /** What is checked, as a statement that should be true, for example "Every guest has replied". */
  label: string;
  outcome: HealthOutcome;
  /** The result in one line, for example "3 guests haven't replied yet". */
  summary: string;
  /** Why: the rule and the data that triggered it (B8-F10). */
  reason: string;
  /** Readable IDs of the records involved, for example ATT-0003. */
  references: readonly string[];
  fix: { target: HealthFixTarget; label: string } | null;
};

export const outcomeRank = (outcome: HealthOutcome) => HEALTH_OUTCOMES.indexOf(outcome);

export const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** "Ana Reyes (ATT-0003), Ben Cruz (ATT-0007) and 4 more": at most `max` named. */
export function nameList(records: readonly { reference: string; name: string }[], max = 5): string {
  const named = records.slice(0, max).map((r) => `${r.name} (${r.reference})`);
  const rest = records.length - named.length;
  if (rest > 0) return `${named.join(", ")} and ${rest} more`;
  if (named.length <= 1) return named[0] ?? "";
  return `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
}