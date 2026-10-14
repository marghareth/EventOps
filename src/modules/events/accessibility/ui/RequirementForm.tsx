// src/modules/events/accessibility/ui/RequirementForm.tsx
// The accessibility need form: adding and editing (B3-04). The page passes the bound server action;
// this component collects input and shows the server's answer. Choices, labels, descriptions and
// limits come from the canonical definitions (D-057), and the server validates every value again
// with the same schema. Types the attendee already has are shown but can't be chosen (one per
// type, D-056). Radio groups are fieldsets with a legend, so screen readers announce the question.
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_REQUIREMENT_PRIORITY,
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_DEFINITIONS,
  REQUIREMENT_TYPES,
  REQUIREMENT_TYPE_DEFINITIONS,
  type RequirementType,
} from "../domain/requirement-type";
import { initialRequirementFormState, type RequirementFormState } from "../form-state";
import { ACCESSIBILITY_LIMITS, REQUIREMENT_FIELDS, type RequirementField } from "../schema";
import { FieldError, RadioOption } from "./RadioOption";

type Props = {
  action: (state: RequirementFormState, formData: FormData) => Promise<RequirementFormState>;
  /** Where Cancel goes: the attendee's details page. */
  cancelHref: string;
  /** Types this attendee already has (other than the one being edited). */
  takenTypes: readonly RequirementType[];
  /** "edit" needs `saved` (the stored values) and `version` (its updatedAt, D-032). */
  mode?: "add" | "edit";
  saved?: Record<RequirementField, string>;
  version?: string;
};

const TEXT = {
  add: { submit: "Add need", busy: "Adding…", failed: "Couldn't add the need" },
  edit: { submit: "Save changes", busy: "Saving changes…", failed: "Couldn't save the changes" },
} as const;

export function RequirementForm({
  action,
  cancelHref,
  takenTypes,
  mode = "add",
  saved,
  version,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialRequirementFormState);
  const text = TEXT[mode];
  const id = (field: RequirementField) => `${mode}-requirement-${field}`;
  const error = (field: RequirementField) => state.fieldErrors?.[field];
  const value = (field: RequirementField, fallback = "") =>
    state.values?.[field] ?? saved?.[field] ?? fallback;
  // The radio groups link from the error summary to their first option.
  const firstOptionId = { type: `${id("type")}-0`, priority: `${id("priority")}-0` } as const;
  const summary: FormErrorItem[] = REQUIREMENT_FIELDS.flatMap((field) => {
    const message = error(field);
    if (!message) return [];
    const fieldId = field === "note" ? id("note") : firstOptionId[field];
    return [{ fieldId, message }];
  });
  // Re-mount fields after each server answer so defaultValue shows what the user typed.
  const formKey = JSON.stringify(state.values ?? {});
  const chosenType = value("type");
  const noteHint = `Required for Other. Visible to Owners and Coordinators only. Up to ${ACCESSIBILITY_LIMITS.note} characters.`;

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

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={error("type") ? `${id("type")}-error` : undefined}
      >
        <legend className="mb-1 text-sm font-semibold text-ink">
          What does the guest need?<span aria-hidden="true"> *</span>
          <span className="sr-only"> (required)</span>
        </legend>
        {error("type") ? <FieldError id={`${id("type")}-error`} message={error("type")!} /> : null}
        {REQUIREMENT_TYPES.map((type, index) => {
          const definition = REQUIREMENT_TYPE_DEFINITIONS[type];
          const taken = takenTypes.includes(type);
          const optionId = `${id("type")}-${index}`;
          return (
            <RadioOption
              key={type}
              id={optionId}
              name="type"
              value={type}
              label={taken ? `${definition.label} (already added)` : definition.label}
              description={definition.description}
              defaultChecked={chosenType === type}
              disabled={taken}
            />
          );
        })}
      </fieldset>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={error("priority") ? `${id("priority")}-error` : undefined}
      >
        <legend className="mb-1 text-sm font-semibold text-ink">How important is it?</legend>
        {error("priority") ? (
          <FieldError id={`${id("priority")}-error`} message={error("priority")!} />
        ) : null}
        <div className="grid gap-2 sm:grid-cols-3">
          {REQUIREMENT_PRIORITIES.map((priority, index) => {
            const definition = REQUIREMENT_PRIORITY_DEFINITIONS[priority];
            const optionId = `${id("priority")}-${index}`;
            return (
              <RadioOption
                key={priority}
                id={optionId}
                name="priority"
                value={priority}
                label={definition.label}
                description={definition.description}
                defaultChecked={value("priority", DEFAULT_REQUIREMENT_PRIORITY) === priority}
              />
            );
          })}
        </div>
      </fieldset>

      <FormField label="Note" id={id("note")} hint={noteHint} error={error("note")}>
        {(control) => (
          <textarea
            {...control}
            name="note"
            rows={3}
            maxLength={ACCESSIBILITY_LIMITS.note}
            defaultValue={value("note")}
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