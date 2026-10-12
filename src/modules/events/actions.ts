// src/modules/events/actions.ts
// Event server actions. Server actions are public HTTP endpoints, so each one checks the user
// itself and validates every input on the server (PROJECT_RULES sections 7 and 8).
"use server";

import { redirect } from "next/navigation";
import { ensureDemoUserRecord, requireUser } from "@/lib/auth";
import { fieldErrorsFrom } from "@/lib/auth-rules";
import { getDb } from "@/lib/db";
import { isDemoWithoutDatabase } from "@/lib/demo-auth";
import { createEvent, type CreatedEvent } from "./create-event";
import {
  CREATE_EVENT_FIELDS,
  CREATE_EVENT_MESSAGES,
  type CreateEventField,
  type CreateEventFormState,
} from "./form-state";
import { createEventFormSchema, toNewEvent } from "./schema";

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