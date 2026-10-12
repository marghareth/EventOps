// src/modules/events/ui/CreateEventForm.tsx
// Create Event form (B1-02). The server action is passed in by the page; this component only
// collects input and shows the server's answer. Validation happens on the server.
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { Button } from "@/components/ui/button";
import {
  CREATE_EVENT_FIELDS,
  initialCreateEventState,
  type CreateEventField,
  type CreateEventFormState,
} from "../form-state";
import { EventFormFields, eventFieldId } from "./EventFormFields";

type CreateEventFormProps = {
  action: (state: CreateEventFormState, formData: FormData) => Promise<CreateEventFormState>;
};

const id = (field: CreateEventField) => eventFieldId("create-event", field);

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

      <EventFormFields idPrefix="create-event" value={value} error={error} />

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