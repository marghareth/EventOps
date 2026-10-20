// src/modules/events/impact/domain/impact-item.ts
// One identified impact and its severity (B7-F08, B7-F09; D-101). Pure: no database, clock or AI.
// Severity is decided by the rules in docs/impact-rules.md, never by a model.

/** The approved scale (brand book, D-101). Most serious first. */
export const IMPACT_SEVERITIES = ["CRITICAL", "NEEDS_ATTENTION", "INFO", "PASSED"] as const;
export type ImpactSeverity = (typeof IMPACT_SEVERITIES)[number];

/** Words for each severity. Always shown with an icon, never by colour alone. */
export const IMPACT_SEVERITY_LABEL: Record<ImpactSeverity, string> = {
  CRITICAL: "Critical",
  NEEDS_ATTENTION: "Needs attention",
  INFO: "Info",
  PASSED: "Passed",
};

/** The operational areas Batch 7 checks (D-101). Transport and volunteers are not built. */
export const IMPACT_AREAS = ["SEATING", "CATERING", "BUDGET", "ACCESSIBILITY", "TASKS"] as const;
export type ImpactArea = (typeof IMPACT_AREAS)[number];

export const IMPACT_AREA_LABEL: Record<ImpactArea, string> = {
  SEATING: "Seating",
  CATERING: "Catering",
  BUDGET: "Budget",
  ACCESSIBILITY: "Accessibility",
  TASKS: "Tasks",
};

/**
 * ESTIMATE: worked out from a planning number or an assumption, so it may be wrong.
 * RECORDED: read from records already stored for the event (guests' needs, budget lines, tasks).
 */
export type ImpactBasis = "ESTIMATE" | "RECORDED";

/** Where the organizer goes to act on an impact. The page turns it into a link. */
export const IMPACT_FIX_TARGETS = [
  "settings",
  "assumptions",
  "budget",
  "accessibility",
  "tasks",
] as const;
export type ImpactFixTarget = (typeof IMPACT_FIX_TARGETS)[number];

export type ImpactAssumptionUsed = { label: string; value: string };

export type ImpactItem = {
  /** Stable for the same input, for example "seating-capacity" or "accessibility:CAPTIONING:not-set-up". */
  key: string;
  area: ImpactArea;
  severity: ImpactSeverity;
  /** One short line: what may happen. */
  title: string;
  /** Why it was identified: the numbers compared and what they mean (B7-F09). */
  reason: string;
  basis: ImpactBasis;
  /** The assumptions the item depends on, as shown to the user (B7-F09). */
  assumptions: readonly ImpactAssumptionUsed[];
  fix: { target: ImpactFixTarget; label: string } | null;
  /** Readable IDs of records involved, for example TSK-0003. */
  references: readonly string[];
};

export const severityRank = (severity: ImpactSeverity): number =>
  IMPACT_SEVERITIES.indexOf(severity);

/** The most serious severity in a list, or null for an empty list. */
export function worstSeverity(severities: readonly ImpactSeverity[]): ImpactSeverity | null {
  let worst: ImpactSeverity | null = null;
  for (const severity of severities) {
    if (worst === null || severityRank(severity) < severityRank(worst)) worst = severity;
  }
  return worst;
}

/** Most serious first; then the area order; then the order the rules produced them. */
export function sortImpacts(items: readonly ImpactItem[]): ImpactItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        severityRank(a.item.severity) - severityRank(b.item.severity) ||
        IMPACT_AREAS.indexOf(a.item.area) - IMPACT_AREAS.indexOf(b.item.area) ||
        a.index - b.index,
    )
    .map(({ item }) => item);
}

export function countBySeverity(items: readonly ImpactItem[]): Record<ImpactSeverity, number> {
  const counts: Record<ImpactSeverity, number> = {
    CRITICAL: 0,
    NEEDS_ATTENTION: 0,
    INFO: 0,
    PASSED: 0,
  };
  for (const item of items) counts[item.severity] += 1;
  return counts;
}