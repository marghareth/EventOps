// src/modules/events/accessibility/ui/ResourceForm.tsx
// The form for one event accessibility resource (B3-05, D-061): its status, a seat count for
// accessible seats only, and a note. The page binds the type and passes the stored values and
// version when the resource is set up (D-032). Choices, labels and limits come from the canonical
// definitions; the server validates again with the same schema.
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import {
  RESOURCE_STATUSES,
  RESOURCE_STATUS_DEFINITIONS,
  RESOURCE_TYPE_DEFINITIONS,
  type ResourceType,
} from "../domain/resource";
import { initialResourceFormState, type ResourceFormState } from "../form-state";
import { ACCESSIBILITY_LIMITS, RESOURCE_FIELDS, type ResourceField } from "../schema";
import { FieldError, RadioOption } from "./RadioOption";

type Props = {
  action: (state: ResourceFormState, formData: FormData) => Promise<ResourceFormState>;
  type: ResourceType;
  /** Where Cancel goes: the Accessibility page. */
  cancelHref: string;
  /** The stored values and version when the resource is set up; absent when "Not set up". */
  saved?: Record<ResourceField, string>;
  version?: string;
};

export function ResourceForm({ action, type, cancelHref, saved, version }: Props) {
  const [state, formAction, pending] = useActionState(action, initialResourceFormState);
  const hasQuantity = RESOURCE_TYPE_DEFINITIONS[type].hasQuantity;
  const editing = Boolean(version);
  const id = (field: ResourceField) => `resource-${field}`;
  const error = (field: ResourceField) => state.fieldErrors?.[field];
  const value = (field: ResourceField) => state.values?.[field] ?? saved?.[field] ?? "";
  const summary: FormErrorItem[] = RESOURCE_FIELDS.flatMap((field) => {
    const message = error(field);
    if (!message) return [];
    return [{ fieldId: field === "status" ? `${id("status")}-0` : id(field), message }];
  });
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
        <Banner severity="critical" title="Couldn't save the resource">
          {state.message}
        </Banner>
      ) : null}
      {state.status === "success" && state.message ? (
        <Banner severity="info" title={state.message} />
      ) : null}
      <input type="hidden" name="version" value={version ?? ""} />

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={error("status") ? `${id("status")}-error` : undefined}
      >
        <legend className="mb-1 text-sm font-semibold text-ink">
          Is it available?<span aria-hidden="true"> *</span>
          <span className="sr-only"> (required)</span>
        </legend>
        {error("status") ? (
          <FieldError id={`${id("status")}-error`} message={error("status")!} />
        ) : null}
        <div className="grid gap-2 sm:grid-cols-3">
          {RESOURCE_STATUSES.map((status, index) => (
            <RadioOption
              key={status}
              id={`${id("status")}-${index}`}
              name="status"
              value={status}
              label={RESOURCE_STATUS_DEFINITIONS[status].label}
              description={RESOURCE_STATUS_DEFINITIONS[status].description}
              defaultChecked={value("status") === status}
            />
          ))}
        </div>
      </fieldset>

      {hasQuantity ? (
        <FormField
          label="Number of accessible seats"
          id={id("quantity")}
          hint={`A whole number from 0 to ${ACCESSIBILITY_LIMITS.seats.toLocaleString("en-US")}.`}
          error={error("quantity")}
          required
        >
          {(control) => (
            <input
              {...control}
              name="quantity"
              type="number"
              inputMode="numeric"
              min={0}
              max={ACCESSIBILITY_LIMITS.seats}
              step={1}
              defaultValue={value("quantity")}
              className={fieldControlClass}
            />
          )}
        </FormField>
      ) : null}

      <FormField
        label="Note (optional)"
        id={id("note")}
        hint={`Where it is or who arranges it, for example "Ramp at the side entrance". Every member of the event can see it. Up to ${ACCESSIBILITY_LIMITS.note} characters.`}
        error={error("note")}
      >
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
          {pending ? "Saving…" : editing ? "Save changes" : "Set up"}
        </Button>
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}