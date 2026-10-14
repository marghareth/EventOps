// src/modules/events/accessibility/domain/resource.ts
// The canonical accessibility resource definitions (B3-02, D-057) and what changed between two
// versions of a resource (for the audit log, D-059). Pure: no database, no clock, safe for client
// components. The database enums and the audit registry's copies are kept equal by tests.

/** What the event can provide. Order is the order shown on the Accessibility page. */
export const RESOURCE_TYPES = [
  "ACCESSIBLE_SEATS",
  "ACCESSIBLE_ENTRANCE",
  "RAMP_OR_ELEVATOR",
  "ACCESSIBLE_RESTROOM",
  "CAPTIONING",
  "SIGN_LANGUAGE",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

type ResourceTypeDefinition = {
  label: string;
  description: string;
  /** True when the resource has a count (accessible seats only, D-056). */
  hasQuantity: boolean;
};

export const RESOURCE_TYPE_DEFINITIONS: Record<ResourceType, ResourceTypeDefinition> = {
  ACCESSIBLE_SEATS: {
    label: "Accessible seats",
    description: "Seats with space for a wheelchair or with easy access. Record how many.",
    hasQuantity: true,
  },
  ACCESSIBLE_ENTRANCE: {
    label: "Accessible entrance",
    description: "A step-free way into the venue.",
    hasQuantity: false,
  },
  RAMP_OR_ELEVATOR: {
    label: "Ramp or elevator",
    description: "Step-free access between levels or areas inside the venue.",
    hasQuantity: false,
  },
  ACCESSIBLE_RESTROOM: {
    label: "Accessible restroom",
    description: "A restroom with more space and grab bars.",
    hasQuantity: false,
  },
  CAPTIONING: {
    label: "Captioning",
    description: "Live captions for the spoken parts of the event.",
    hasQuantity: false,
  },
  SIGN_LANGUAGE: {
    label: "Sign-language interpreter",
    description: "An interpreter for the spoken parts of the event.",
    hasQuantity: false,
  },
};

/** Whether a resource is in place (D-056). No stored row means "Not set up". */
export const RESOURCE_STATUSES = ["NOT_AVAILABLE", "ARRANGING", "AVAILABLE"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export const RESOURCE_STATUS_DEFINITIONS: Record<
  ResourceStatus,
  { label: string; description: string }
> = {
  NOT_AVAILABLE: { label: "Not available", description: "The event can't provide this." },
  ARRANGING: { label: "Being arranged", description: "Planned, but not confirmed yet." },
  AVAILABLE: { label: "Available", description: "In place and confirmed." },
};

/** Shown for a type with no stored row. */
export const NOT_SET_UP_LABEL = "Not set up";

/** The most accessible seats one event can record. A sanity limit, not a business rule. */
export const MAX_ACCESSIBLE_SEATS = 10_000;

export function isResourceType(value: unknown): value is ResourceType {
  return typeof value === "string" && (RESOURCE_TYPES as readonly string[]).includes(value);
}

/** The resource type in an address, for example "accessible-seats". Lower case, readable. */
export function resourceSlug(type: ResourceType): string {
  return type.toLowerCase().replaceAll("_", "-");
}

/** The resource type for an address segment, or null for anything that isn't one of the six. */
export function resourceTypeFromSlug(slug: unknown): ResourceType | null {
  if (typeof slug !== "string") return null;
  return RESOURCE_TYPES.find((type) => resourceSlug(type) === slug) ?? null;
}

/** A resource's editable values, as validated (schema.ts). */
export type ResourceInput = {
  status: ResourceStatus;
  /** Accessible seats only; null for every other type. */
  quantity: number | null;
  note: string | null;
};

/** What changed, for "accessibility_resource.updated". The note is free text: changed only. */
export type ResourceChanges = {
  status?: { from: ResourceStatus; to: ResourceStatus };
  quantity?: { from: number | null; to: number | null };
  note?: { changed: true };
};

export function resourceChanges(before: ResourceInput, after: ResourceInput): ResourceChanges {
  const changes: ResourceChanges = {};
  if (before.status !== after.status) changes.status = { from: before.status, to: after.status };
  if (before.quantity !== after.quantity) {
    changes.quantity = { from: before.quantity, to: after.quantity };
  }
  if (before.note !== after.note) changes.note = { changed: true };
  return changes;
}