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

/**
 * Supplier categories as stored (B4-02, D-069). The audit registry keeps its own copy (it can't
 * import the suppliers context); tests keep it equal to the canonical list and the database enum.
 */
export const SUPPLIER_CATEGORIES = [
  "VENUE",
  "CATERING",
  "CAKE_AND_DESSERTS",
  "PHOTO_AND_VIDEO",
  "SOUND_AND_LIGHTS",
  "ENTERTAINMENT",
  "FLOWERS_AND_STYLING",
  "HAIR_AND_MAKEUP",
  "ATTIRE",
  "RENTALS",
  "TRANSPORT",
  "PRINTING_AND_STATIONERY",
  "OTHER",
] as const;
/** The supplier's readable ID, for example SUP-0001 (D-068). */
const supplierReference = z.string().regex(/^SUP-\d{4,}$/);
const supplierCategory = z.enum(SUPPLIER_CATEGORIES);
/** A category with, for Other, what the supplier provides: compared and shown together. */
const supplierCategoryValue = z
  .object({ category: supplierCategory, detail: z.string().nullable() })
  .strict();

/**
 * Supplier fields as recorded in "supplier.updated" (B4-04, D-071). Name and category are business
 * values, recorded old → new; contact person, email, phone and notes only as "changed".
 */
export const supplierChangesSchema = z
  .object({
    name: fromTo(z.string()),
    category: fromTo(supplierCategoryValue),
    contactName: changedOnly,
    email: changedOnly,
    phone: changedOnly,
    notes: changedOnly,
  })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "An update must change something.");

export type SupplierChanges = z.infer<typeof supplierChangesSchema>;

/**
 * Quote statuses as stored (B4-11, D-076). The audit registry's own copy; tests keep it equal to
 * the canonical list and the database enum.
 */
export const QUOTE_STATUSES = ["PENDING", "ACCEPTED", "DECLINED"] as const;
/** The quote's readable ID, for example QUO-0001 (D-075). */
const quoteReference = z.string().regex(/^QUO-\d{4,}$/);
/** A canonical peso amount as stored, for example "120000.50" (D-075). */
const pesoAmount = z.string().regex(/^(?:0|[1-9]\d{0,9})\.\d{2}$/);
const quoteStatus = z.enum(QUOTE_STATUSES);

/**
 * Quote fields as recorded in "quote.updated" (B4-10, D-076). All business facts, recorded
 * old → new.
 */
export const quoteChangesSchema = z
  .object({
    amount: fromTo(pesoAmount),
    status: fromTo(quoteStatus),
    description: fromTo(z.string().nullable()),
  })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "An update must change something.");

export type QuoteChanges = z.infer<typeof quoteChangesSchema>;

/**
 * Payment kinds and recorded statuses as stored (B4-12, D-077). The audit registry's own copies;
 * tests keep them equal to the canonical lists and the database enums.
 */
export const PAYMENT_KINDS = ["DEPOSIT", "PAYMENT"] as const;
export const PAYMENT_RECORD_STATUSES = ["UNPAID", "PAID"] as const;
/** The payment's readable ID, for example PAY-0001 (D-077). */
const paymentReference = z.string().regex(/^PAY-\d{4,}$/);
const paymentKind = z.enum(PAYMENT_KINDS);
const paymentRecordStatus = z.enum(PAYMENT_RECORD_STATUSES);
/** A calendar date, "2026-11-15" (D-079). */
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Payment fields as recorded in "payment.updated" (B4-14, D-077). Business facts, old → new. */
export const paymentChangesSchema = z
  .object({
    kind: fromTo(paymentKind),
    amount: fromTo(pesoAmount),
    dueDate: fromTo(calendarDate),
    status: fromTo(paymentRecordStatus),
    paidOn: fromTo(calendarDate.nullable()),
    description: fromTo(z.string().nullable()),
  })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "An update must change something.");

export type PaymentChanges = z.infer<typeof paymentChangesSchema>;

/** The budget item's readable ID, for example BUD-0001 (D-085). */
const budgetItemReference = z.string().regex(/^BUD-\d{4,}$/);

/**
 * Budget category fields as recorded in "budget_category.updated" (B5-F01, D-084). Name and
 * allocation are business values, recorded old → new.
 */
export const budgetCategoryChangesSchema = z
  .object({ name: fromTo(z.string()), allocation: fromTo(pesoAmount) })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "An update must change something.");

export type BudgetCategoryChanges = z.infer<typeof budgetCategoryChangesSchema>;

/**
 * Budget item fields as recorded in "budget_item.updated" (B5-F02, D-085). A move to another
 * category is recorded by category NAME, old → new. Amounts are business values, old → new; the
 * notes are free text, recorded as changed, never copied.
 */
export const budgetItemChangesSchema = z
  .object({
    category: fromTo(z.string()),
    name: fromTo(z.string()),
    estimated: fromTo(pesoAmount),
    committed: fromTo(pesoAmount),
    paid: fromTo(pesoAmount),
    notes: changedOnly,
  })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "An update must change something.");

export type BudgetItemChanges = z.infer<typeof budgetItemChangesSchema>;

/**
 * Task priorities as stored (B6-F05, D-095). The audit registry's own copy (it can't import the
 * tasks context); tests keep it equal to the canonical list and the database enum.
 */
export const TASK_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
const taskPriority = z.enum(TASK_PRIORITIES);

/**
 * Task statuses as stored (B6-F06, D-096). The audit registry's own copy; tests keep it equal to
 * the canonical list and the database enum.
 */
export const TASK_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "DONE"] as const;
const taskStatus = z.enum(TASK_STATUSES);

/** The task's readable ID, for example TSK-0001 (D-094). */
const taskReference = z.string().regex(/^TSK-\d{4,}$/);

/**
 * Task fields as recorded in "task.updated" (B6-F02, B6-F04 to B6-F07; D-094 to D-096). The title,
 * the priority, the status and the due date ("YYYY-MM-DD", null is none) are business values,
 * recorded old → new. The assignee is recorded old → new by the
 * member's display name (null is "unassigned"), the one personal detail a task entry holds. The
 * description is free text of up to 2,000 characters: recorded as changed, never copied
 * (docs/audit.md).
 */
export const taskChangesSchema = z
  .object({
    title: fromTo(z.string()),
    description: changedOnly,
    priority: fromTo(taskPriority),
    status: fromTo(taskStatus),
    dueDate: fromTo(calendarDate.nullable()),
    assignee: fromTo(z.string().nullable()),
  })
  .partial()
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, "An update must change something.");

export type TaskChanges = z.infer<typeof taskChangesSchema>;

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
  /**
   * A supplier was added (B4-03, D-070): its readable ID, name and category. Contact details and
   * notes are never copied into the log.
   */
  "supplier.created": {
    entityType: "supplier",
    details: z
      .object({
        reference: supplierReference,
        name: z.string(),
        category: supplierCategory,
        categoryDetail: z.string().nullable(),
      })
      .strict(),
  },
  /** A supplier's details were edited (B4-04, D-071). Only changed fields; contacts as "changed". */
  "supplier.updated": {
    entityType: "supplier",
    details: z.object({ reference: supplierReference, changes: supplierChangesSchema }).strict(),
  },
  /**
   * A supplier was removed (B4-05, D-072). The entry keeps the readable ID and the name; the record
   * is gone.
   */
  "supplier.deleted": {
    entityType: "supplier",
    details: z.object({ reference: supplierReference, name: z.string() }).strict(),
  },
  /**
   * A quote was added to a supplier (B4-09, D-075): its readable ID, the supplier's, the amount in
   * pesos, the status and the description. Quotes hold business facts only, never contact details.
   */
  "quote.created": {
    entityType: "quote",
    details: z
      .object({
        reference: quoteReference,
        supplierReference,
        amount: pesoAmount,
        status: quoteStatus,
        description: z.string().nullable(),
      })
      .strict(),
  },
  /** A quote was edited (B4-10, D-076). Only changed fields, old → new. */
  "quote.updated": {
    entityType: "quote",
    details: z
      .object({ reference: quoteReference, supplierReference, changes: quoteChangesSchema })
      .strict(),
  },
  /**
   * A payment was added to a supplier (B4-14, D-077): its readable ID, the supplier's, kind,
   * amount, due date, recorded status, paid date and description. Business facts only.
   */
  "payment.created": {
    entityType: "payment",
    details: z
      .object({
        reference: paymentReference,
        supplierReference,
        kind: paymentKind,
        amount: pesoAmount,
        dueDate: calendarDate,
        status: paymentRecordStatus,
        paidOn: calendarDate.nullable(),
        description: z.string().nullable(),
      })
      .strict(),
  },
  /** A payment was edited (B4-14, D-077). Only changed fields, old → new. */
  "payment.updated": {
    entityType: "payment",
    details: z
      .object({ reference: paymentReference, supplierReference, changes: paymentChangesSchema })
      .strict(),
  },
  /** A budget category was added (B5-F01, D-084): its name and allocation in pesos. */
  "budget_category.created": {
    entityType: "budget_category",
    details: z.object({ name: z.string(), allocation: pesoAmount }).strict(),
  },
  /** A budget category was edited (B5-F01). The new name, and only the changed fields, old → new. */
  "budget_category.updated": {
    entityType: "budget_category",
    details: z.object({ name: z.string(), changes: budgetCategoryChangesSchema }).strict(),
  },
  /** An empty budget category was removed (B5-F01, D-084). The entry keeps its name and allocation. */
  "budget_category.deleted": {
    entityType: "budget_category",
    details: z.object({ name: z.string(), allocation: pesoAmount }).strict(),
  },
  /**
   * A budget item was added (B5-F02, D-085): its readable ID, name, category name and the three
   * amounts. Notes are never copied into the log.
   */
  "budget_item.created": {
    entityType: "budget_item",
    details: z
      .object({
        reference: budgetItemReference,
        name: z.string(),
        category: z.string(),
        estimated: pesoAmount,
        committed: pesoAmount,
        paid: pesoAmount,
      })
      .strict(),
  },
  /** A budget item was edited (B5-F02). Only changed fields; the notes as "changed". */
  "budget_item.updated": {
    entityType: "budget_item",
    details: z
      .object({ reference: budgetItemReference, changes: budgetItemChangesSchema })
      .strict(),
  },
  /** A budget item was removed (B5-F02). The entry keeps the readable ID and the name. */
  "budget_item.deleted": {
    entityType: "budget_item",
    details: z.object({ reference: budgetItemReference, name: z.string() }).strict(),
  },
  /**
   * A task was added (B6-F01, D-094): its readable ID and title, and, since D-095 and D-096, its
   * priority, status, due date and assignee's name. Entries written before have none of them, so
   * all stay optional. The description is not copied.
   */
  "task.created": {
    entityType: "task",
    details: z
      .object({
        reference: taskReference,
        title: z.string(),
        priority: taskPriority.optional(),
        status: taskStatus.optional(),
        dueDate: calendarDate.nullable().optional(),
        assignee: z.string().nullable().optional(),
      })
      .strict(),
  },
  /** A task was edited (B6-F02). The current title, and only the changed fields. */
  "task.updated": {
    entityType: "task",
    details: z
      .object({ reference: taskReference, title: z.string(), changes: taskChangesSchema })
      .strict(),
  },
  /** A task was removed (B6-F03, D-095). The entry keeps the readable ID and the title. */
  "task.deleted": {
    entityType: "task",
    details: z.object({ reference: taskReference, title: z.string() }).strict(),
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