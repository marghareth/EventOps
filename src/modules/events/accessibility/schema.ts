// src/modules/events/accessibility/schema.ts
// Validation for accessibility input (B3-02, D-057). Forms send strings; these schemas turn them
// into checked values using the canonical definitions in domain/, so the form, the server actions
// and the database CHECKs agree. The server always validates again; the client only uses the same
// definitions to show choices and limits. Pure: no database, no clock, safe for client components.
import { z } from "zod";
import type { RequirementInput } from "./domain/requirement";
import {
  DEFAULT_REQUIREMENT_PRIORITY,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_TYPES,
  REQUIREMENT_TYPE_DEFINITIONS,
} from "./domain/requirement-type";
import {
  MAX_ACCESSIBLE_SEATS,
  RESOURCE_STATUSES,
  RESOURCE_TYPES,
  RESOURCE_TYPE_DEFINITIONS,
  type ResourceInput,
  type ResourceType,
} from "./domain/resource";

export const ACCESSIBILITY_LIMITS = { note: 500, seats: MAX_ACCESSIBLE_SEATS } as const;

/** Characters as Postgres counts them (code points), so emoji count once, like varchar(n). */
const charCount = (value: string) => Array.from(value).length;

/** Optional note: trimmed, empty becomes null (the database refuses blank notes). */
const note = z
  .string()
  .trim()
  .refine(
    (value) => charCount(value) <= ACCESSIBILITY_LIMITS.note,
    `Use ${ACCESSIBILITY_LIMITS.note} characters or fewer.`,
  )
  .transform((value) => (value === "" ? null : value));

export const requirementTypeSchema = z.enum(REQUIREMENT_TYPES, {
  message: "Choose what the guest needs.",
});

/** What the requirement form sends. Every value is a string. */
export const requirementFormSchema = z
  .object({
    type: z.string().trim().pipe(requirementTypeSchema),
    priority: z
      .string()
      .trim()
      .transform((value) => (value === "" ? DEFAULT_REQUIREMENT_PRIORITY : value))
      .pipe(z.enum(REQUIREMENT_PRIORITIES, { message: "Choose how important this is." })),
    note,
  })
  .superRefine((value, ctx) => {
    if (REQUIREMENT_TYPE_DEFINITIONS[value.type].noteRequired && value.note === null) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Describe what the guest needs.",
      });
    }
  }) satisfies z.ZodType<RequirementInput, unknown>;

export type RequirementField = "type" | "priority" | "note";
export const REQUIREMENT_FIELDS: readonly RequirementField[] = ["type", "priority", "note"];

/** A stored requirement as form values (for the edit form): the reverse of the schema. */
export function toRequirementFormValues(
  requirement: RequirementInput,
): Record<RequirementField, string> {
  return {
    type: requirement.type,
    priority: requirement.priority,
    note: requirement.note ?? "",
  };
}

export const resourceTypeSchema = z.enum(RESOURCE_TYPES);

/**
 * What the resource form sends, for one resource type. The type comes from the address, never the
 * form, so the schema is built for it: accessible seats need a count, other types ignore one.
 */
export function resourceFormSchema(type: ResourceType) {
  const hasQuantity = RESOURCE_TYPE_DEFINITIONS[type].hasQuantity;
  return z.object({
    status: z
      .string()
      .trim()
      .pipe(z.enum(RESOURCE_STATUSES, { message: "Choose whether this is available." })),
    quantity: z
      .string()
      .trim()
      .refine(
        (value) =>
          !hasQuantity || (/^\d{1,5}$/.test(value) && Number(value) <= ACCESSIBILITY_LIMITS.seats),
        `Enter how many seats, as a whole number from 0 to ${ACCESSIBILITY_LIMITS.seats.toLocaleString("en-US")}.`,
      )
      .transform((value) => (hasQuantity ? Number(value) : null)),
    note,
  }) satisfies z.ZodType<ResourceInput, unknown>;
}

export type ResourceField = "status" | "quantity" | "note";
export const RESOURCE_FIELDS: readonly ResourceField[] = ["status", "quantity", "note"];

/** A stored resource as form values: the reverse of the schema. */
export function toResourceFormValues(resource: ResourceInput): Record<ResourceField, string> {
  return {
    status: resource.status,
    quantity: resource.quantity === null ? "" : String(resource.quantity),
    note: resource.note ?? "",
  };
}