// src/modules/events/accessibility/domain/gaps.ts
// Accessibility gaps (B3-09, D-064): what is missing, for whom, and what it means for readiness.
// Derived from the coverage (domain/readiness.ts); the rules are in docs/DATA_MODEL.md ("Gaps").
// Pure and deterministic: no database, clock, AI or permission check. Covered needs never produce a
// gap; several gaps can coexist.
import type { Coverage, ReadinessRequirement, RequirementCoverage, SeatCount } from "./readiness";
import { RESOURCE_TYPES, RESOURCE_TYPE_DEFINITIONS, type ResourceType } from "./resource";

export type GapKind =
  "not-set-up" | "not-available" | "being-arranged" | "not-enough-seats" | "check-by-hand";

/** What a gap means for the event's status (D-063). */
export type GapConsequence = "not-ready" | "almost-ready" | "advice";

export type Gap = {
  /** Stable for the same input, for example "CAPTIONING:not-set-up" or "check-by-hand:<id>". */
  key: string;
  kind: GapKind;
  /** The resource that is missing or short; null for check by hand. */
  resource: ResourceType | null;
  /** The affected requirements, by guest number then type order. */
  requirements: ReadinessRequirement[];
  consequence: GapConsequence;
  /** For not-enough-seats only. */
  seats: SeatCount | null;
  /** One plain sentence built from the canonical labels. */
  summary: string;
};

export const GAP_CONSEQUENCE_TEXT: Record<GapConsequence, string> = {
  "not-ready": "Makes the event Not ready.",
  "almost-ready": "Keeps the event at Almost ready.",
  advice: "Advice only: Preferred needs don't change readiness.",
};

const CONSEQUENCE_ORDER: GapConsequence[] = ["not-ready", "almost-ready", "advice"];

/** The guest's readable ID, in the attendees context's format (D-042). */
export const guestReference = (number: number) => `ATT-${String(number).padStart(4, "0")}`;

const count2 = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const guests = (count: number) => (count === 1 ? "1 guest needs it" : `${count} guests need it`);

function summaryFor(
  kind: GapKind,
  resource: ResourceType | null,
  requirements: ReadinessRequirement[],
  seats: SeatCount,
): string {
  if (kind === "check-by-hand") {
    const { attendee } = requirements[0];
    return `${attendee.name} (${guestReference(attendee.number)}) has an Other need that EventOps can't check. Confirm it with the venue or your team.`;
  }
  const label = RESOURCE_TYPE_DEFINITIONS[resource!].label;
  const count = new Set(requirements.map((r) => r.attendee.id)).size;
  switch (kind) {
    case "not-set-up":
      return `${label} is not set up, but ${guests(count)}.`;
    case "not-available":
      return `${label} is marked Not available, but ${guests(count)}.`;
    case "being-arranged":
      return `${label} is still being arranged; ${guests(count)}.`;
    case "not-enough-seats":
      return seats.available < seats.required
        ? `Not enough accessible seats: ${count2(seats.required, "guest", "guests")} with a Required need, ${count2(seats.available, "seat", "seats")} available.`
        : `Not enough accessible seats for Preferred needs: ${seats.required + seats.preferred} needed in all, ${seats.available} available.`;
  }
}

const KIND_FOR_PROBLEM = {
  "not-set-up": "not-set-up",
  "not-available": "not-available",
  arranging: "being-arranged",
  short: "not-enough-seats",
} as const;

function consequenceFor(kind: GapKind, affected: RequirementCoverage[]): GapConsequence {
  if (!affected.some((item) => item.role === "decides")) return "advice";
  return kind === "being-arranged" || kind === "check-by-hand" ? "almost-ready" : "not-ready";
}

/** Every gap in the coverage, in a fixed order (D-064). */
export function detectGaps(coverage: Coverage): Gap[] {
  const groups = new Map<
    string,
    { kind: GapKind; resource: ResourceType; items: RequirementCoverage[] }
  >();
  const gaps: Gap[] = [];

  for (const item of coverage.requirements) {
    if (item.state === "check-by-hand") {
      const kind: GapKind = "check-by-hand";
      gaps.push({
        key: `check-by-hand:${item.requirement.id}`,
        kind,
        resource: null,
        requirements: [item.requirement],
        consequence: consequenceFor(kind, [item]),
        seats: null,
        summary: summaryFor(kind, null, [item.requirement], coverage.seats),
      });
      continue;
    }
    for (const { resource, problem } of item.problems) {
      const kind = KIND_FOR_PROBLEM[problem];
      const key = `${resource}:${kind}`;
      const group = groups.get(key) ?? { kind, resource, items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
  }

  for (const [key, { kind, resource, items }] of groups) {
    const requirements = items.map((item) => item.requirement);
    gaps.push({
      key,
      kind,
      resource,
      requirements,
      consequence: consequenceFor(kind, items),
      seats: kind === "not-enough-seats" ? { ...coverage.seats } : null,
      summary: summaryFor(kind, resource, requirements, coverage.seats),
    });
  }

  const resourceRank = (gap: Gap) =>
    gap.resource === null ? RESOURCE_TYPES.length : RESOURCE_TYPES.indexOf(gap.resource);
  return gaps.sort(
    (a, b) =>
      CONSEQUENCE_ORDER.indexOf(a.consequence) - CONSEQUENCE_ORDER.indexOf(b.consequence) ||
      resourceRank(a) - resourceRank(b) ||
      a.requirements[0].attendee.number - b.requirements[0].attendee.number ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}