// src/modules/events/attendees/ui/AttendeeForm.tsx
// The attendee form: adding (B2-02) and editing (B2-03). The bound server action is passed in by the
// page; this component collects input and shows the server's answer. The server validates every value (attendeeFormSchema)
// and is the real check; length limits here only stop typing past what the server accepts.
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { initialAttendeeFormState, type AttendeeFormState } from "../form-state";
import {
  ATTENDEE_FIELDS,
  ATTENDEE_LIMITS,
  DEFAULT_RSVP,
  RSVP_LABEL,
  RSVP_STATUSES,
  type AttendeeField,
} from "../schema";

type AttendeeFormProps = {
  action: (state: AttendeeFormState, formData: FormData) => Promise<AttendeeFormState>;
  /** Where Cancel goes: the event's guest list. */
  cancelHref: string;
  /** "edit" needs `saved` (the stored values) and `version` (its updatedAt, D-032). */
  mode?: "add" | "edit";
  saved?: Record<AttendeeField, string>;
  version?: string;
};

const TEXT = {
  add: { submit: "Add attendee", busy: "Adding attendee…", failed: "Couldn't add the attendee" },
  edit: { submit: "Save changes", busy: "Saving changes…", failed: "Couldn't save the changes" },
} as const;

const limit = (max: number) => `Up to ${max.toLocaleString("en-US")} characters.`;

export function AttendeeForm({
  action,
  cancelHref,
  mode = "add",
  saved,
  version,
}: AttendeeFormProps) {
  const [state, formAction, pending] = useActionState(action, initialAttendeeFormState);
  const text = TEXT[mode];
  const fieldId = (field: AttendeeField) => `${mode}-attendee-${field}`;
  const summary: FormErrorItem[] = ATTENDEE_FIELDS.flatMap((field) => {
    const message = state.fieldErrors?.[field];
    return message ? [{ fieldId: fieldId(field), message }] : [];
  });
  const error = (field: AttendeeField) => state.fieldErrors?.[field];
  // What the user typed after a failed save, else the stored values (edit), else the defaults.
  const value = (field: AttendeeField, fallback = "") =>
    state.values?.[field] ?? saved?.[field] ?? fallback;
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
      <FormErrorSummary errors={summary} />
      {state.status === "error" && state.message ? (
        <Banner severity="critical" title={text.failed}>
          {state.message}
        </Banner>
      ) : null}
      {state.status === "success" && state.message ? (
        <Banner severity="info" title={state.message} />
      ) : null}
      {version ? <input type="hidden" name="version" value={version} /> : null}

      <FormField label="Name" id={fieldId("name")} error={error("name")} required>
        {(control) => (
          <input
            {...control}
            name="name"
            type="text"
            autoComplete="off"
            maxLength={ATTENDEE_LIMITS.name}
            defaultValue={value("name")}
            className={fieldControlClass}
          />
        )}
      </FormField>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold">Contact (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email" id={fieldId("email")} error={error("email")}>
            {(control) => (
              <input
                {...control}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                maxLength={ATTENDEE_LIMITS.email}
                defaultValue={value("email")}
                className={fieldControlClass}
              />
            )}
          </FormField>
          <FormField
            label="Phone"
            id={fieldId("phone")}
            hint="For example 0917 123 4567 or +63 917 123 4567."
            error={error("phone")}
          >
            {(control) => (
              <input
                {...control}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                maxLength={ATTENDEE_LIMITS.phone}
                defaultValue={value("phone")}
                className={fieldControlClass}
              />
            )}
          </FormField>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="RSVP" id={fieldId("rsvpStatus")} error={error("rsvpStatus")}>
          {(control) => (
            <select
              {...control}
              name="rsvpStatus"
              defaultValue={value("rsvpStatus", DEFAULT_RSVP)}
              className={fieldControlClass}
            >
              {RSVP_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {RSVP_LABEL[status]}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField
          label="Plus-ones"
          id={fieldId("plusOnes")}
          hint={`Guests coming with them, 0 to ${ATTENDEE_LIMITS.plusOnes}.`}
          error={error("plusOnes")}
        >
          {(control) => (
            <input
              {...control}
              name="plusOnes"
              type="number"
              inputMode="numeric"
              min={0}
              max={ATTENDEE_LIMITS.plusOnes}
              step={1}
              defaultValue={value("plusOnes", "0")}
              className={fieldControlClass}
            />
          )}
        </FormField>
        <FormField
          label="Category (optional)"
          id={fieldId("category")}
          hint="For example Family or Colleagues."
          error={error("category")}
        >
          {(control) => (
            <input
              {...control}
              name="category"
              type="text"
              maxLength={ATTENDEE_LIMITS.category}
              defaultValue={value("category")}
              className={fieldControlClass}
            />
          )}
        </FormField>
      </div>

      <FormField
        label="Dietary needs (optional)"
        id={fieldId("dietaryNeeds")}
        hint={`For example vegetarian, no nuts or halal. ${limit(ATTENDEE_LIMITS.dietaryNeeds)}`}
        error={error("dietaryNeeds")}
      >
        {(control) => (
          <textarea
            {...control}
            name="dietaryNeeds"
            rows={2}
            maxLength={ATTENDEE_LIMITS.dietaryNeeds}
            defaultValue={value("dietaryNeeds")}
            className={`${fieldControlClass} py-3`}
          />
        )}
      </FormField>

      <FormField
        label="Notes (optional)"
        id={fieldId("notes")}
        hint={limit(ATTENDEE_LIMITS.notes)}
        error={error("notes")}
      >
        {(control) => (
          <textarea
            {...control}
            name="notes"
            rows={4}
            maxLength={ATTENDEE_LIMITS.notes}
            defaultValue={value("notes")}
            className={`${fieldControlClass} py-3`}
          />
        )}
      </FormField>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} aria-disabled={pending}>
          {pending ? text.busy : text.submit}
        </Button>
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}