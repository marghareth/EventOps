// src/modules/events/attendees/schema.ts
// Validation for attendee input (B2-01, D-042). Forms send strings; this turns them into a checked
// attendee. Limits match the database CHECK constraints and column sizes, so the form explains a
// problem before Postgres rejects it. Pure: no database, no clock.
import { z } from "zod";
import { RSVP_STATUSES, type AttendeeChanges } from "@/modules/events/audit/public";

export { RSVP_STATUSES };
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const ATTENDEE_LIMITS = {
  name: 120,
  email: 254,
  phone: 32,
  category: 60,
  dietaryNeeds: 500,
  notes: 2000,
  plusOnes: 10,
} as const;

export const RSVP_LABEL: Record<RsvpStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
  MAYBE: "Maybe",
};

/** New attendees start here (D-042): a business default, so it lives in the domain. */
export const DEFAULT_RSVP: RsvpStatus = "PENDING";

/** Characters as Postgres counts them (code points), so emoji count once, like varchar(n). */
function charCount(value: string): number {
  return Array.from(value).length;
}

const tooLong = (label: string, max: number) =>
  `${label} can be at most ${max.toLocaleString("en-US")} characters.`;

/** Optional text: trimmed, empty becomes null (the database refuses blank strings). */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((value) => charCount(value) <= max, tooLong(label, max))
    .transform((value) => (value === "" ? null : value));

/** Digits, spaces, dashes, brackets and one leading "+": local and international formats. */
const PHONE_PATTERN = /^\+?[0-9(][0-9 ()-]*$/;
const PHONE_MESSAGE = "Enter a phone number like 0917 123 4567 or +63 917 123 4567.";

/** What an attendee form sends. Every value is a string; empty optional fields are "". */
export const attendeeFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Enter the attendee's name.", abort: true })
    .refine(
      (value) => charCount(value) <= ATTENDEE_LIMITS.name,
      `Use ${ATTENDEE_LIMITS.name} characters or fewer.`,
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value) => charCount(value) <= ATTENDEE_LIMITS.email,
      tooLong("Email", ATTENDEE_LIMITS.email),
    )
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter an email like name@example.com.",
    )
    .transform((value) => (value === "" ? null : value)),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => charCount(value) <= ATTENDEE_LIMITS.phone,
      tooLong("Phone", ATTENDEE_LIMITS.phone),
    )
    .refine((value) => {
      if (value === "") return true;
      const digits = value.replace(/\D/g, "").length;
      return PHONE_PATTERN.test(value) && digits >= 7 && digits <= 15;
    }, PHONE_MESSAGE)
    .transform((value) => (value === "" ? null : value)),
  category: optionalText(ATTENDEE_LIMITS.category, "Category"),
  rsvpStatus: z
    .string()
    .trim()
    .transform((value) => (value === "" ? DEFAULT_RSVP : value))
    .pipe(z.enum(RSVP_STATUSES, { message: "Choose an RSVP status." })),
  plusOnes: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" || (/^\d{1,2}$/.test(value) && Number(value) <= ATTENDEE_LIMITS.plusOnes),
      `Plus-ones must be a whole number from 0 to ${ATTENDEE_LIMITS.plusOnes}.`,
    )
    .transform((value) => (value === "" ? 0 : Number(value))),
  dietaryNeeds: optionalText(ATTENDEE_LIMITS.dietaryNeeds, "Dietary needs"),
  notes: optionalText(ATTENDEE_LIMITS.notes, "Notes"),
});

export type AttendeeForm = z.input<typeof attendeeFormSchema>;
export type AttendeeField = keyof AttendeeForm;

export const ATTENDEE_FIELDS = Object.keys(attendeeFormSchema.shape) as AttendeeField[];

/** The checked values the attendee use cases store. */
export type AttendeeInput = z.output<typeof attendeeFormSchema>;

/** A stored attendee as form values (for an edit form): the reverse of the schema. */
export function toAttendeeFormValues(attendee: AttendeeInput): Required<AttendeeForm> {
  return {
    name: attendee.name,
    email: attendee.email ?? "",
    phone: attendee.phone ?? "",
    category: attendee.category ?? "",
    rsvpStatus: attendee.rsvpStatus,
    plusOnes: String(attendee.plusOnes),
    dietaryNeeds: attendee.dietaryNeeds ?? "",
    notes: attendee.notes ?? "",
  };
}

/** "ATT-0001": the readable attendee ID, at least four digits (D-042). */
export function formatAttendeeReference(number: number): string {
  return `ATT-${String(number).padStart(4, "0")}`;
}

/**
 * What changed, for the audit log (D-037, D-042). Name, RSVP, plus-ones and category are recorded
 * old → new; contact details, dietary needs and notes only as "changed", never their values.
 */
export function attendeeChanges(before: AttendeeInput, after: AttendeeInput): AttendeeChanges {
  const changes: AttendeeChanges = {};
  if (before.name !== after.name) changes.name = { from: before.name, to: after.name };
  if (before.rsvpStatus !== after.rsvpStatus) {
    changes.rsvpStatus = { from: before.rsvpStatus, to: after.rsvpStatus };
  }
  if (before.plusOnes !== after.plusOnes) {
    changes.plusOnes = { from: before.plusOnes, to: after.plusOnes };
  }
  if (before.category !== after.category) {
    changes.category = { from: before.category, to: after.category };
  }
  for (const field of ["email", "phone", "dietaryNeeds", "notes"] as const) {
    if (before[field] !== after[field]) changes[field] = { changed: true };
  }
  return changes;
}