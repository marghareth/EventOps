// src/modules/events/accessibility/domain/requirement-type.ts
// The canonical accessibility requirement definitions (B3-02, D-057). Everything else (the form,
// server validation, the details page, the audit registry's copy and the database enum) follows
// these lists; tests keep them equal. Labels describe what is needed, never the person.
// Pure: no database, no clock, safe for client components.

/** What an attendee can need. Order is the order shown in forms and lists. */
export const REQUIREMENT_TYPES = [
  "MOBILITY_ASSISTANCE",
  "ACCESSIBLE_SEATING",
  "STEP_FREE_ENTRANCE",
  "ACCESSIBLE_RESTROOM",
  "SIGN_LANGUAGE",
  "CAPTIONING",
  "OTHER",
] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

type RequirementTypeDefinition = {
  /** Short name for lists, badges and the Activity feed. */
  label: string;
  /** One sentence for the form, saying what the need covers. */
  description: string;
  /** True when the note must say what is needed (OTHER). */
  noteRequired: boolean;
};

export const REQUIREMENT_TYPE_DEFINITIONS: Record<RequirementType, RequirementTypeDefinition> = {
  MOBILITY_ASSISTANCE: {
    label: "Mobility assistance",
    description:
      "Uses a wheelchair or another mobility aid, or needs help moving around the venue.",
    noteRequired: false,
  },
  ACCESSIBLE_SEATING: {
    label: "Accessible seating",
    description: "Needs a seat with space for a wheelchair or with easy access.",
    noteRequired: false,
  },
  STEP_FREE_ENTRANCE: {
    label: "Step-free entry",
    description:
      "Needs to get in and around without steps: a ramp, an elevator or a level entrance.",
    noteRequired: false,
  },
  ACCESSIBLE_RESTROOM: {
    label: "Accessible restroom",
    description: "Needs a restroom they can use, for example with more space and grab bars.",
    noteRequired: false,
  },
  SIGN_LANGUAGE: {
    label: "Sign-language interpretation",
    description: "Needs an interpreter for the spoken parts of the event.",
    noteRequired: false,
  },
  CAPTIONING: {
    label: "Captioning",
    description: "Needs live captions for the spoken parts of the event.",
    noteRequired: false,
  },
  OTHER: {
    label: "Other",
    description: "Something not listed. Say what is needed in the note.",
    noteRequired: true,
  },
};

/**
 * How firmly a requirement must be met (D-057). Readiness rules (later in Batch 3) count only
 * REQUIRED; PREFERRED is shown but never makes the event "not ready"; INFORMATIONAL is context for
 * staff and never counted.
 */
export const REQUIREMENT_PRIORITIES = ["REQUIRED", "PREFERRED", "INFORMATIONAL"] as const;
export type RequirementPriority = (typeof REQUIREMENT_PRIORITIES)[number];

/** New requirements are Required: a business default, so it lives in the domain. */
export const DEFAULT_REQUIREMENT_PRIORITY: RequirementPriority = "REQUIRED";

export const REQUIREMENT_PRIORITY_DEFINITIONS: Record<
  RequirementPriority,
  { label: string; description: string }
> = {
  REQUIRED: {
    label: "Required",
    description: "Must be in place for this guest. Counts toward accessibility readiness.",
  },
  PREFERRED: {
    label: "Preferred",
    description:
      "Would help, but the guest can attend without it. Never marks the event not ready.",
  },
  INFORMATIONAL: {
    label: "For information",
    description: "Context for staff, nothing to arrange. Never counted.",
  },
};

export function isRequirementType(value: unknown): value is RequirementType {
  return typeof value === "string" && (REQUIREMENT_TYPES as readonly string[]).includes(value);
}