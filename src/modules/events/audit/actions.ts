// src/modules/events/audit/actions.ts
// The controlled list of audited business actions (B1-11, D-037). Only these can be written to the
// audit log, each with a strict schema for its details, so nothing unexpected (and no unnecessary
// personal data) is stored. Add an action here when a feature that needs it is built, and list it
// in docs/AUDIT.md. Do not audit reads or every query.
import { z } from "zod";

/** A before → after pair of plain values. Dates are ISO strings. */
const fromTo = <T extends z.ZodType>(value: T) => z.object({ from: value, to: value }).strict();
const isoDate = z.iso.datetime();

/** Event detail fields as recorded in "event.updated" (D-037). */
export const eventChangesSchema = z
  .object({
    name: fromTo(z.string()),
    venue: fromTo(z.string().nullable()),
    // Free text of up to 5,000 characters: recorded as changed, never copied (docs/AUDIT.md).
    description: z.object({ changed: z.literal(true) }).strict(),
    startsAt: fromTo(isoDate),
    endsAt: fromTo(isoDate.nullable()),
    capacity: fromTo(z.number().int().nullable()),
    expectedAttendees: fromTo(z.number().int()),
  })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "An update must change something.");

export type EventChanges = z.infer<typeof eventChangesSchema>;

/** RSVP values as stored (D-042). A test keeps this list equal to the database enum. */
export const RSVP_STATUSES = ["PENDING", "CONFIRMED", "DECLINED", "MAYBE"] as const;

/** The attendee's readable ID, for example ATT-0001 (D-042). */
const attendeeReference = z.string().regex(/^ATT-\d{4,}$/);
/** Personal or free-text fields: recorded as changed, never copied (docs/AUDIT.md, D-042). */
const changedOnly = z.object({ changed: z.literal(true) }).strict();

/** Attendee fields as recorded in "attendee.updated" (B2-01, D-042). */
export const attendeeChangesSchema = z
  .object({
    name: fromTo(z.string()),
    rsvpStatus: fromTo(z.enum(RSVP_STATUSES)),
    plusOnes: fromTo(z.number().int()),
    category: fromTo(z.string().nullable()),
    email: changedOnly,
    phone: changedOnly,
    dietaryNeeds: changedOnly,
    notes: changedOnly,
  })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "An update must change something.");

export type AttendeeChanges = z.infer<typeof attendeeChangesSchema>;

/**
 * Accessibility values as stored (B3-01, D-056, D-057). The audit registry keeps its own copies for
 * validating log entries (it can't import the accessibility context); tests keep them equal to the
 * accessibility definitions and the database enums.
 */
export const ACCESSIBILITY_REQUIREMENT_TYPES = [
  "MOBILITY_ASSISTANCE",
  "ACCESSIBLE_SEATING",
  "STEP_FREE_ENTRANCE",
  "ACCESSIBLE_RESTROOM",
  "SIGN_LANGUAGE",
  "CAPTIONING",
  "OTHER",
] as const;
export const REQUIREMENT_PRIORITIES = ["REQUIRED", "PREFERRED", "INFORMATIONAL"] as const;
export const ACCESSIBILITY_RESOURCE_TYPES = [
  "ACCESSIBLE_SEATS",
  "ACCESSIBLE_ENTRANCE",
  "RAMP_OR_ELEVATOR",
  "ACCESSIBLE_RESTROOM",
  "CAPTIONING",
  "SIGN_LANGUAGE",
] as const;
export const RESOURCE_STATUSES = ["NOT_AVAILABLE", "ARRANGING", "AVAILABLE"] as const;

const requirementType = z.enum(ACCESSIBILITY_REQUIREMENT_TYPES);
const requirementPriority = z.enum(REQUIREMENT_PRIORITIES);

/**
 * Requirement fields as recorded in "accessibility_requirement.updated" (B3-03, D-059). The note
 * may hold health details: recorded as changed, never copied.
 */
export const requirementChangesSchema = z
  .object({
    type: fromTo(requirementType),
    priority: fromTo(requirementPriority),
    note: changedOnly,
  })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "An update must change something.");

export type RequirementChanges = z.infer<typeof requirementChangesSchema>;

const resourceType = z.enum(ACCESSIBILITY_RESOURCE_TYPES);
const resourceStatus = z.enum(RESOURCE_STATUSES);
const seatCount = z.number().int().min(0).nullable();

/**
 * Resource fields as recorded in "accessibility_resource.updated" (B3-05, D-061). Status and seat
 * count are business values, recorded old → new; the note is free text, recorded as changed.
 */
export const resourceChangesSchema = z
  .object({ status: fromTo(resourceStatus), quantity: fromTo(seatCount), note: changedOnly })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "An update must change something.");

export type ResourceChanges = z.infer<typeof resourceChangesSchema>;

/** Who an attendee entry is about: the readable ID and the name at that moment. */
const attendeeIdentity = z.object({ reference: attendeeReference, name: z.string() }).strict();

export const AUDIT_ACTIONS = {
  /** An event was created (B1-02). */
  "event.created": {
    entityType: "event",
    details: z.object({ reference: z.string(), name: z.string() }).strict(),
  },
  /** An event's details were edited (B1-05). Only changed fields, old → new. */
  "event.updated": {
    entityType: "event",
    details: z.object({ changes: eventChangesSchema }).strict(),
  },
  /** An attendee was added (B2-01). */
  "attendee.created": { entityType: "attendee", details: attendeeIdentity },
  /** An attendee's details were edited (B2-01). Only changed fields; personal ones as "changed". */
  "attendee.updated": {
    entityType: "attendee",
    details: z.object({ reference: attendeeReference, changes: attendeeChangesSchema }).strict(),
  },
  /** An attendee was removed (B2-01). The entry keeps who it was; the record is gone. */
  "attendee.deleted": { entityType: "attendee", details: attendeeIdentity },
  /**
   * Attendees were imported from a CSV file (B2-18, D-052). One entry per import, about the event:
   * counts and the range of new IDs only, never names or file contents.
   */
  /** The guest list was downloaded as CSV (B2-19, D-053). How many attendees, nothing else. */
  "attendees.exported": {
    entityType: "event",
    details: z.object({ count: z.number().int().min(0) }).strict(),
  },
  "attendees.imported": {
    entityType: "event",
    details: z
      .object({
        count: z.number().int().min(1),
        first: attendeeReference,
        last: attendeeReference,
        skipped: z.number().int().min(0),
      })
      .strict(),
  },
  /**
   * An accessibility requirement was added to an attendee (B3-03, D-059). The attendee's readable
   * ID, the type and the priority; never the note or the name.
   */
  "accessibility_requirement.created": {
    entityType: "accessibility_requirement",
    details: z
      .object({
        reference: attendeeReference,
        type: requirementType,
        priority: requirementPriority,
      })
      .strict(),
  },
  /** A requirement was edited (B3-03). Only changed fields; the note as "changed". */
  "accessibility_requirement.updated": {
    entityType: "accessibility_requirement",
    details: z
      .object({
        reference: attendeeReference,
        type: requirementType,
        changes: requirementChangesSchema,
      })
      .strict(),
  },
  /** A requirement was removed (B3-03). The entry keeps the attendee's ID and the type. */
  "accessibility_requirement.deleted": {
    entityType: "accessibility_requirement",
    details: z.object({ reference: attendeeReference, type: requirementType }).strict(),
  },
  /** An event accessibility resource was set up (B3-05, D-061): type, status and seat count. */
  "accessibility_resource.created": {
    entityType: "accessibility_resource",
    details: z.object({ type: resourceType, status: resourceStatus, quantity: seatCount }).strict(),
  },
  /** A resource was edited (B3-05). Only changed fields; the note as "changed". */
  "accessibility_resource.updated": {
    entityType: "accessibility_resource",
    details: z.object({ type: resourceType, changes: resourceChangesSchema }).strict(),
  },
  /** A resource was removed; the type shows as "Not set up" again (B3-05). */
  "accessibility_resource.deleted": {
    entityType: "accessibility_resource",
    details: z.object({ type: resourceType }).strict(),
  },
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;
export type AuditDetails<A extends AuditAction> = z.infer<(typeof AUDIT_ACTIONS)[A]["details"]>;

export function isAuditAction(value: string): value is AuditAction {
  return Object.hasOwn(AUDIT_ACTIONS, value);
}

/** Validated details for a stored entry, or null if the action is unknown or the data is invalid. */
export function readAuditDetails(
  action: string,
  details: unknown,
): { action: AuditAction; details: unknown } | null {
  if (!isAuditAction(action)) return null;
  const parsed = AUDIT_ACTIONS[action].details.safeParse(details);
  return parsed.success ? { action, details: parsed.data } : null;
}