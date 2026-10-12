// src/modules/events/ui/EditEventForm.tsx
// Edit Event form (B1-05). Shows the saved values, sends them with the version it loaded (so stale
// saves are refused, D-032), and confirms success. Validation and permissions are checked on the
// server; the page renders this form only for roles that may edit.
"use client";

import { useActionState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { Button } from "@/components/ui/button";
import {
  CREATE_EVENT_FIELDS,
  initialEditEventState,
  type CreateEventField,
  type EditEventFormState,
} from "../form-state";
import { EventFormFields, eventFieldId } from "./EventFormFields";

type EditEventFormProps = {
  action: (state: EditEventFormState, formData: FormData) => Promise<EditEventFormState>;
  /** The saved values, already in form shape (toEventFormValues). */
  saved: Record<CreateEventField, string>;
  /** The event's updatedAt when the page loaded, as an ISO string. */
  version: string;
};

const PREFIX = "edit-event";

export function EditEventForm({ action, saved, version }: EditEventFormProps) {
  const [state, formAction, pending] = useActionState(action, initialEditEventState);
  const failed = state.status === "error";
  // After an error, show what the user typed; otherwise the saved values (fresh after a save).
  const value = (field: CreateEventField) =>
    failed ? (state.values?.[field] ?? "") : saved[field];
  const error = (field: CreateEventField) => (failed ? state.fieldErrors?.[field] : undefined);
  const summary: FormErrorItem[] = CREATE_EVENT_FIELDS.flatMap((field) => {
    const message = error(field);
    return message ? [{ fieldId: eventFieldId(PREFIX, field), message }] : [];
  });
  // Re-mount the fields when the saved version or the typed values change, so defaultValue applies.
  const formKey = failed ? JSON.stringify(state.values ?? {}) : version;

  return (
    <form
      key={formKey}
      action={formAction}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="version" value={version} />
      <FormErrorSummary errors={summary} />
      {failed && state.message ? (
        <Banner severity="critical" title="Couldn't save your changes">
          {state.message}
        </Banner>
      ) : null}
      {state.status === "success" ? (
        <Banner severity="success" title={state.message ?? "Changes saved."} />
      ) : null}

      <EventFormFields idPrefix={PREFIX} value={value} error={error} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} aria-disabled={pending}>
          {pending ? "Saving changes…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}