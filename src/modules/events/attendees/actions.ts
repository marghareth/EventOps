// src/modules/events/attendees/actions.ts
// Attendee server actions (B2-01, D-042). Server actions are public HTTP endpoints, so each one
// authorizes first with authorizeEvent(eventId, "attendees.manage") (D-036) and validates every
// input on the server. IDs come from the bound arguments, are checked here, and the use cases
// re-check the role in the database.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsFrom } from "@/lib/auth-rules";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import { authorizeEvent, sampleCreateAttendee } from "@/modules/events/public";
import { createAttendee, type CreateAttendeeResult } from "./create-attendee";
import { deleteAttendee } from "./delete-attendee";
import {
  ATTENDEE_MESSAGES,
  type AttendeeFormState,
  type DeleteAttendeeFormState,
} from "./form-state";
import { ATTENDEE_FIELDS, attendeeFormSchema, type AttendeeField } from "./schema";
import { updateAttendee } from "./update-attendee";

const idSchema = z.uuid();
const versionSchema = z.iso.datetime();

function formValues(formData: FormData): Record<AttendeeField, string> {
  const values = {} as Record<AttendeeField, string>;
  for (const field of ATTENDEE_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

const attendeesPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/attendees`;

const REFUSED = {
  "not-found": ATTENDEE_MESSAGES.eventNotFound,
  forbidden: ATTENDEE_MESSAGES.forbidden,
} as const;

/**
 * Adds an attendee to the event, then opens the guest list with an "added" notice (B2-02).
 * Owners and Coordinators (attendees.manage).
 */
export async function createAttendeeAction(
  eventId: string,
  _previous: AttendeeFormState,
  formData: FormData,
): Promise<AttendeeFormState> {
  const auth = await authorizeEvent(eventId, "attendees.manage", attendeesPath(eventId));
  const values = formValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };

  const parsed = attendeeFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  let result: CreateAttendeeResult;
  try {
    const args = { eventId: auth.event.id, creatorId: auth.user.id, attendee: parsed.data };
    // Dev-only sample data (D-041): kept in memory until the dev server restarts.
    result = isSampleDataMode()
      ? sampleCreateAttendee({ ...args, now: new Date() })
      : await createAttendee(getDb(), args);
  } catch {
    // Database unreachable or a constraint failed: nothing was saved (one transaction).
    return { status: "error", message: ATTENDEE_MESSAGES.saveFailed, values };
  }
  // Refused in the database: the role changed after the check above.
  if (!result.ok) return { status: "error", message: ATTENDEE_MESSAGES.forbidden, values };

  revalidatePath(attendeesPath(auth.event.id));
  // redirect() works by throwing, so it stays outside the try block.
  redirect(
    `${attendeesPath(auth.event.id)}?added=${encodeURIComponent(result.attendee.reference)}`,
  );
}

/** Saves an attendee's details, unless someone else saved them first (D-032). */
export async function updateAttendeeAction(
  eventId: string,
  attendeeId: string,
  _previous: AttendeeFormState,
  formData: FormData,
): Promise<AttendeeFormState> {
  const auth = await authorizeEvent(eventId, "attendees.manage", attendeesPath(eventId));
  const values = formValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };
  if (!idSchema.safeParse(attendeeId).success) {
    return { status: "error", message: ATTENDEE_MESSAGES.attendeeNotFound, values };
  }

  const parsed = attendeeFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  const version = versionSchema.safeParse(formData.get("version"));
  if (!version.success) return { status: "error", message: ATTENDEE_MESSAGES.stale, values };
  if (isSampleDataMode()) return { status: "error", message: ATTENDEE_MESSAGES.sampleData, values };

  try {
    const result = await updateAttendee(getDb(), {
      eventId: auth.event.id,
      attendeeId,
      editorId: auth.user.id,
      version: new Date(version.data),
      details: parsed.data,
    });
    if (!result.ok) {
      const message =
        result.reason === "stale" ? ATTENDEE_MESSAGES.stale : ATTENDEE_MESSAGES.attendeeNotFound;
      return { status: "error", message, values };
    }
  } catch {
    return { status: "error", message: ATTENDEE_MESSAGES.saveFailed, values };
  }
  revalidatePath(attendeesPath(auth.event.id));
  return { status: "success", message: ATTENDEE_MESSAGES.saved };
}

/**
 * Permanently removes an attendee from the event. Owners and Coordinators (attendees.manage). Works
 * with useActionState: the form state and data it passes after the bound IDs are not needed.
 */
export async function deleteAttendeeAction(
  eventId: string,
  attendeeId: string,
): Promise<DeleteAttendeeFormState> {
  const auth = await authorizeEvent(eventId, "attendees.manage", attendeesPath(eventId));
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason] };
  if (!idSchema.safeParse(attendeeId).success) {
    return { status: "error", message: ATTENDEE_MESSAGES.attendeeNotFound };
  }
  if (isSampleDataMode()) return { status: "error", message: ATTENDEE_MESSAGES.sampleData };

  try {
    const result = await deleteAttendee(getDb(), {
      eventId: auth.event.id,
      attendeeId,
      userId: auth.user.id,
    });
    if (!result.ok) return { status: "error", message: ATTENDEE_MESSAGES.attendeeNotFound };
  } catch {
    return { status: "error", message: ATTENDEE_MESSAGES.deleteFailed };
  }
  revalidatePath(attendeesPath(auth.event.id));
  return { status: "success", message: ATTENDEE_MESSAGES.deleted };
}