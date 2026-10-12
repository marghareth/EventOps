// src/modules/events/ui/CreateEventForm.tsx
// Create Event form (B1-02). The server action is passed in by the page; this component only
// collects input and shows the server's answer. Validation happens on the server.
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import {
  CREATE_EVENT_FIELDS,
  initialCreateEventState,
  type CreateEventField,
  type CreateEventFormState,
} from "../form-state";
import { EVENT_LIMITS } from "../schema";

type CreateEventFormProps = {
  action: (state: CreateEventFormState, formData: FormData) => Promise<CreateEventFormState>;
};

const id = (field: CreateEventField) => `create-event-${field}`;

function summary(state: CreateEventFormState): FormErrorItem[] {
  return CREATE_EVENT_FIELDS.flatMap((field) => {
    const message = state.fieldErrors?.[field];
    return message ? [{ fieldId: id(field), message }] : [];
  });
}

export function CreateEventForm({ action }: CreateEventFormProps) {
  const [state, formAction, pending] = useActionState(action, initialCreateEventState);
  const error = (field: CreateEventField) => state.fieldErrors?.[field];
  const value = (field: CreateEventField) => state.values?.[field] ?? "";
  // Re-mount fields after each server answer so defaultValue shows what the user typed.
  const formKey = JSON.stringify(state.values ?? {});

  return (
    <form
      key={formKey}
      action={formAction}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-6"
    >
      <FormErrorSummary errors={summary(state)} />
      {state.message ? (
        <Banner severity="critical" title="Couldn't create the event">
          {state.message}
        </Banner>
      ) : null}

      <FormField label="Event name" id={id("name")} error={error("name")} required>
        {(control) => (
          <input
            {...control}
            name="name"
            type="text"
            autoComplete="off"
            defaultValue={value("name")}
            className={fieldControlClass}
          />
        )}
      </FormField>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">When</legend>
        <p id="create-event-when-hint" className="text-xs text-ink-3">
          Philippine time (PHT). The end time is on the same day.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Date" id={id("date")} error={error("date")} required>
            {(control) => (
              <input
                {...control}
                name="date"
                type="date"
                defaultValue={value("date")}
                className={fieldControlClass}
              />
            )}
          </FormField>
          <FormField label="Start time" id={id("startTime")} error={error("startTime")} required>
            {(control) => (
              <input
                {...control}
                name="startTime"
                type="time"
                defaultValue={value("startTime")}
                className={fieldControlClass}
              />
            )}
          </FormField>
          <FormField label="End time (optional)" id={id("endTime")} error={error("endTime")}>
            {(control) => (
              <input
                {...control}
                name="endTime"
                type="time"
                defaultValue={value("endTime")}
                className={fieldControlClass}
              />
            )}
          </FormField>
        </div>
      </fieldset>

      <FormField
        label="Venue (optional)"
        id={id("venue")}
        hint={`Up to ${EVENT_LIMITS.venue} characters.`}
        error={error("venue")}
      >
        {(control) => (
          <input
            {...control}
            name="venue"
            type="text"
            defaultValue={value("venue")}
            className={fieldControlClass}
          />
        )}
      </FormField>

      <FormField
        label="Description (optional)"
        id={id("description")}
        hint="Anything the team should know about this event."
        error={error("description")}
      >
        {(control) => (
          <textarea
            {...control}
            name="description"
            rows={4}
            defaultValue={value("description")}
            className={`${fieldControlClass} py-3`}
          />
        )}
      </FormField>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Numbers (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Venue capacity"
            id={id("capacity")}
            hint="Seats the venue can hold."
            error={error("capacity")}
          >
            {(control) => (
              <input
                {...control}
                name="capacity"
                type="text"
                inputMode="numeric"
                defaultValue={value("capacity")}
                className={fieldControlClass}
              />
            )}
          </FormField>
          <FormField
            label="Expected attendees"
            id={id("expectedAttendees")}
            hint="Your planning estimate. You can change it later."
            error={error("expectedAttendees")}
          >
            {(control) => (
              <input
                {...control}
                name="expectedAttendees"
                type="text"
                inputMode="numeric"
                defaultValue={value("expectedAttendees")}
                className={fieldControlClass}
              />
            )}
          </FormField>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} aria-disabled={pending}>
          {pending ? "Creating event…" : "Create event"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/events">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}