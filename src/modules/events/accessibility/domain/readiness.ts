// src/modules/events/accessibility/domain/readiness.ts
// Accessibility readiness: which of the event's requirements are covered by its resources (B3-07,
// D-062). The rules are written in docs/DATA_MODEL.md ("Accessibility readiness") and must change
// there first. Pure and deterministic: no database, clock, network, AI or permission check; the
// same input always gives the same result in the same order. Never stored.
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_TYPES,
  isRequirementType,
  type RequirementPriority,
  type RequirementType,
} from "./requirement-type";
import { RESOURCE_TYPES, type ResourceStatus, type ResourceType } from "./resource";

/** A guest's RSVP, as the attendees context stores it (D-049). Declined guests are left out. */
export type GuestRsvp = "PENDING" | "CONFIRMED" | "MAYBE" | "DECLINED";

/** One requirement as readiness needs it: never the note (D-058). */
export type ReadinessRequirement = {
  id: string;
  type: RequirementType;
  priority: RequirementPriority;
  attendee: { id: string; number: number; name: string; rsvpStatus: GuestRsvp };
};

/** One recorded resource. Types with no record are "Not set up". */
export type ReadinessResource = {
  type: ResourceType;
  status: ResourceStatus;
  /** Accessible seats only. */
  quantity: number | null;
};

export type ReadinessInput = {
  requirements: readonly ReadinessRequirement[];
  resources: readonly ReadinessResource[];
};

/** How a requirement takes part (options 1a, 2a). */
export type Role =
  /** Required, guest not declined: decides readiness. */
  | "decides"
  /** Preferred, guest not declined: checked, advice only. */
  | "advice";

export type ExclusionReason = "declined" | "for-information";

/** What is wrong with one resource a requirement depends on. */
export type ResourceProblem = "not-set-up" | "not-available" | "arranging" | "short";

/** A requirement's result, worst first: missing, short, arranging, then covered. */
export type CoverageState = "missing" | "short" | "arranging" | "check-by-hand" | "covered";

export type RequirementCoverage = {
  requirement: ReadinessRequirement;
  role: Role;
  /** The resources this need depends on, in definition order. Empty for Other. */
  dependsOn: ResourceType[];
  /** Problems with those resources, in definition order. Empty when covered or Other. */
  problems: { resource: ResourceType; problem: ResourceProblem }[];
  state: CoverageState;
};

export type SeatCount = {
  /** Seats recorded as Available; 0 when seats are not Available. */
  available: number;
  /** Counted Required seating needs. */
  required: number;
  /** Counted Preferred seating needs. */
  preferred: number;
};

export type Coverage = {
  /** Counted requirements (decides or advice), sorted by guest number, type order, then ID. */
  requirements: RequirementCoverage[];
  /** Requirements left out, with why, in the same order. */
  excluded: { requirement: ReadinessRequirement; reason: ExclusionReason }[];
  seats: SeatCount;
};

const byGuestThenType = (a: ReadinessRequirement, b: ReadinessRequirement) =>
  a.attendee.number - b.attendee.number ||
  REQUIREMENT_TYPES.indexOf(a.type) - REQUIREMENT_TYPES.indexOf(b.type) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const byResourceOrder = (a: ResourceType, b: ResourceType) =>
  RESOURCE_TYPES.indexOf(a) - RESOURCE_TYPES.indexOf(b);

/**
 * Thrown for input the database could never produce: two resources of one type, or a requirement
 * with an unknown type or priority (B3-14). Refused rather than guessed, so an unsupported need is
 * never silently treated as covered or as advice.
 */
export class InvalidReadinessInput extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReadinessInput";
  }
}

/** The resources a requirement type depends on, given what is recorded (option 3a). */
function dependencies(type: RequirementType, recorded: ReadonlyMap<ResourceType, unknown>) {
  switch (type) {
    case "ACCESSIBLE_SEATING":
      return ["ACCESSIBLE_SEATS"] as ResourceType[];
    case "STEP_FREE_ENTRANCE":
    case "MOBILITY_ASSISTANCE":
      // Ramp or elevator only once recorded: the venue's levels are unknown (DATA_MODEL.md).
      return recorded.has("RAMP_OR_ELEVATOR")
        ? (["ACCESSIBLE_ENTRANCE", "RAMP_OR_ELEVATOR"] as ResourceType[])
        : (["ACCESSIBLE_ENTRANCE"] as ResourceType[]);
    case "ACCESSIBLE_RESTROOM":
      return ["ACCESSIBLE_RESTROOM"] as ResourceType[];
    case "SIGN_LANGUAGE":
      return ["SIGN_LANGUAGE"] as ResourceType[];
    case "CAPTIONING":
      return ["CAPTIONING"] as ResourceType[];
    case "OTHER":
      return [] as ResourceType[];
  }
}

const SEVERITY: Record<CoverageState, number> = {
  missing: 4,
  short: 3,
  arranging: 2,
  "check-by-hand": 1,
  covered: 0,
};

function stateFrom(problems: { problem: ResourceProblem }[]): CoverageState {
  let state: CoverageState = "covered";
  for (const { problem } of problems) {
    const next: CoverageState =
      problem === "not-set-up" || problem === "not-available"
        ? "missing"
        : problem === "short"
          ? "short"
          : "arranging";
    if (SEVERITY[next] > SEVERITY[state]) state = next;
  }
  return state;
}

/** Which counted requirements are covered by the recorded resources (B3-07, D-062). */
export function assessCoverage(input: ReadinessInput): Coverage {
  const recorded = new Map<ResourceType, ReadinessResource>();
  for (const resource of input.resources) {
    if (recorded.has(resource.type)) {
      throw new InvalidReadinessInput(`Two resources of type ${resource.type}.`);
    }
    recorded.set(resource.type, resource);
  }

  for (const requirement of input.requirements) {
    if (!isRequirementType(requirement.type)) {
      throw new InvalidReadinessInput(`Unsupported requirement type ${String(requirement.type)}.`);
    }
    if (!(REQUIREMENT_PRIORITIES as readonly string[]).includes(requirement.priority)) {
      throw new InvalidReadinessInput(`Unsupported priority ${String(requirement.priority)}.`);
    }
  }

  const sorted = [...input.requirements].sort(byGuestThenType);
  const excluded: Coverage["excluded"] = [];
  const counted: { requirement: ReadinessRequirement; role: Role }[] = [];
  for (const requirement of sorted) {
    if (requirement.attendee.rsvpStatus === "DECLINED") {
      excluded.push({ requirement, reason: "declined" });
    } else if (requirement.priority === "INFORMATIONAL") {
      excluded.push({ requirement, reason: "for-information" });
    } else {
      counted.push({
        requirement,
        role: requirement.priority === "REQUIRED" ? "decides" : "advice",
      });
    }
  }

  const seatsResource = recorded.get("ACCESSIBLE_SEATS");
  const seats: SeatCount = {
    available: seatsResource?.status === "AVAILABLE" ? Math.max(0, seatsResource.quantity ?? 0) : 0,
    required: counted.filter(
      (c) => c.requirement.type === "ACCESSIBLE_SEATING" && c.role === "decides",
    ).length,
    preferred: counted.filter(
      (c) => c.requirement.type === "ACCESSIBLE_SEATING" && c.role === "advice",
    ).length,
  };

  const problemWith = (resource: ResourceType, role: Role): ResourceProblem | null => {
    const record = recorded.get(resource);
    if (!record) return "not-set-up";
    if (record.status === "NOT_AVAILABLE") return "not-available";
    if (record.status === "ARRANGING") return "arranging";
    if (resource === "ACCESSIBLE_SEATS") {
      // Required guests first; Preferred only with seats left after them (DATA_MODEL.md).
      const needed = role === "decides" ? seats.required : seats.required + seats.preferred;
      if (seats.available < needed) return "short";
    }
    return null;
  };

  const requirements = counted.map(({ requirement, role }): RequirementCoverage => {
    const dependsOn = [...dependencies(requirement.type, recorded)].sort(byResourceOrder);
    if (dependsOn.length === 0) {
      return { requirement, role, dependsOn, problems: [], state: "check-by-hand" };
    }
    const problems = dependsOn.flatMap((resource) => {
      const problem = problemWith(resource, role);
      return problem ? [{ resource, problem }] : [];
    });
    return { requirement, role, dependsOn, problems, state: stateFrom(problems) };
  });

  return { requirements, excluded, seats };
}