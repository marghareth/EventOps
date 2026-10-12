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