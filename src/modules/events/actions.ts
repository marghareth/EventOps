// src/modules/events/actions.ts
// Event server actions. Server actions are public HTTP endpoints, so each one checks the user
// itself and validates every input on the server (PROJECT_RULES sections 7 and 8).
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureDemoUserRecord, requireUser } from "@/lib/auth";
import { fieldErrorsFrom } from "@/lib/auth-rules";
import { getDb } from "@/lib/db";
import { isDemoWithoutDatabase } from "@/lib/demo-auth";
import { authorizeEvent } from "./authorize";
import { createEvent, type CreatedEvent } from "./create-event";
import { deleteEvent } from "./delete-event";
import {
  CREATE_EVENT_FIELDS,
  CREATE_EVENT_MESSAGES,
  DELETE_EVENT_MESSAGES,
  EDIT_EVENT_MESSAGES,
  type CreateEventField,
  type CreateEventFormState,
  type DeleteEventFormState,
  type EditEventFormState,
} from "./form-state";
import { createEventFormSchema, sameEventDetails, toNewEvent } from "./schema";
import { updateEvent } from "./update-event";

function formValues(formData: FormData): Record<CreateEventField, string> {
  const values = {} as Record<CreateEventField, string>;
  for (const field of CREATE_EVENT_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/**
 * B1-02: creates an event owned by the signed-in user and opens its workspace.
 * Any signed-in user may create events; the creator becomes the event's OWNER.
 */
export async function createEventAction(
  _previous: CreateEventFormState,
  formData: FormData,
): Promise<CreateEventFormState> {
  // Signed out: redirects to sign in and creates nothing.
  const user = await requireUser("/events/new");

  const values = formValues(formData);
  const parsed = createEventFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  if (isDemoWithoutDatabase()) {
    return { status: "error", message: CREATE_EVENT_MESSAGES.noDatabase, values };
  }

  let created: CreatedEvent;
  try {
    await ensureDemoUserRecord();
    created = await createEvent(getDb(), {
      event: toNewEvent(parsed.data),
      creatorId: user.id,
      now: new Date(),
    });
  } catch {
    // Database unreachable, a constraint failed, or anything unexpected: nothing was saved
    // (one transaction). Show a safe message and keep what the user typed.
    return { status: "error", message: CREATE_EVENT_MESSAGES.saveFailed, values };
  }

  // redirect() works by throwing, so it stays outside the try block.
  redirect(`/events/${created.id}?created=${encodeURIComponent(created.reference)}`);
}

const versionSchema = z.iso.datetime();

/**
 * B1-05: saves the event's details. Members whose role may edit (D-031) only, and only if nobody
 * else saved since the form was opened (D-032). The event ID is bound by the page and verified here.
 */
export async function updateEventAction(
  eventId: string,
  _previous: EditEventFormState,
  formData: FormData,
): Promise<EditEventFormState> {
  const auth = await authorizeEvent(
    eventId,
    "event.edit",
    `/events/${encodeURIComponent(eventId)}/settings`,
  );
  const values = formValues(formData);
  if (!auth.ok) {
    const message = {
      "no-database": EDIT_EVENT_MESSAGES.noDatabase,
      // Same answer for another user's event as for a missing one (D-027).
      "not-found": EDIT_EVENT_MESSAGES.notFound,
      forbidden: EDIT_EVENT_MESSAGES.forbidden,
    }[auth.reason];
    return { status: "error", message, values };
  }
  const { user, event } = auth;

  const parsed = createEventFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  const version = versionSchema.safeParse(formData.get("version"));
  if (!version.success) return { status: "error", message: EDIT_EVENT_MESSAGES.stale, values };

  const details = toNewEvent(parsed.data);
  if (sameEventDetails(event, details)) {
    return { status: "success", message: EDIT_EVENT_MESSAGES.unchanged };
  }

  try {
    const result = await updateEvent(getDb(), {
      eventId: event.id,
      editorId: user.id,
      version: new Date(version.data),
      details,
    });
    if (!result.ok) {
      const message =
        result.reason === "stale" ? EDIT_EVENT_MESSAGES.stale : EDIT_EVENT_MESSAGES.notFound;
      return { status: "error", message, values };
    }
  } catch {
    return { status: "error", message: EDIT_EVENT_MESSAGES.saveFailed, values };
  }

  // Refresh the whole workspace (header, overview, this form) with the saved values.
  revalidatePath(`/events/${event.id}`, "layout");
  return { status: "success", message: EDIT_EVENT_MESSAGES.saved };
}

/**
 * B1-06: permanently deletes the event and everything in it (D-004). Owners only (D-033), and only
 * after the user typed the event number. Then opens My events with a "deleted" notice.
 */
export async function deleteEventAction(
  eventId: string,
  _previous: DeleteEventFormState,
  formData: FormData,
): Promise<DeleteEventFormState> {
  const auth = await authorizeEvent(
    eventId,
    "event.delete",
    `/events/${encodeURIComponent(eventId)}/settings`,
  );
  if (!auth.ok) {
    const message = {
      "no-database": DELETE_EVENT_MESSAGES.noDatabase,
      // Same answer for another user's event as for a missing one (D-027).
      "not-found": DELETE_EVENT_MESSAGES.notFound,
      forbidden: DELETE_EVENT_MESSAGES.forbidden,
    }[auth.reason];
    return { status: "error", message };
  }
  const { user, event } = auth;
  const typed = formData.get("confirmation");
  if (typeof typed !== "string" || typed.trim() !== event.reference) {
    return { status: "error", message: DELETE_EVENT_MESSAGES.confirmation };
  }

  try {
    const result = await deleteEvent(getDb(), { eventId: event.id, userId: user.id });
    if (!result.ok) return { status: "error", message: DELETE_EVENT_MESSAGES.notFound };
  } catch {
    return { status: "error", message: DELETE_EVENT_MESSAGES.failed };
  }

  revalidatePath("/events");
  // redirect() works by throwing, so it stays outside the try block.
  redirect(`/events?deleted=${encodeURIComponent(event.reference)}`);
}