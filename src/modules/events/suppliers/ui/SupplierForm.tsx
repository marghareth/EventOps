// src/modules/events/suppliers/ui/SupplierForm.tsx
// The supplier form: adding (B4-03) and editing (B4-04). The bound server action is passed in by the
// page; this component collects input and shows the server's answer. The server validates every
// value (supplierFormSchema) and is the real check; length limits here only stop typing past what
// the server accepts. "What they provide" appears only for the Other category (D-069).
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_CATEGORY_DEFINITIONS,
  isSupplierCategory,
} from "../categories";
import { initialSupplierFormState, type SupplierFormState } from "../form-state";
import { SUPPLIER_FIELDS, SUPPLIER_LIMITS, type SupplierField } from "../schema";

type SupplierFormProps = {
  action: (state: SupplierFormState, formData: FormData) => Promise<SupplierFormState>;
  /** Where Cancel goes: the event's supplier list. */
  cancelHref: string;
  /** "edit" needs `saved` (the stored values) and `version` (its updatedAt, D-032). */
  mode?: "add" | "edit";
  saved?: Record<SupplierField, string>;
  version?: string;
};

const TEXT = {
  add: { submit: "Add supplier", busy: "Adding supplier…", failed: "Couldn't add the supplier" },
  edit: { submit: "Save changes", busy: "Saving changes…", failed: "Couldn't save the changes" },
} as const;

const limit = (max: number) => `Up to ${max.toLocaleString("en-US")} characters.`;

export function SupplierForm({
  action,
  cancelHref,
  mode = "add",
  saved,
  version,
}: SupplierFormProps) {
  const [state, formAction, pending] = useActionState(action, initialSupplierFormState);
  const text = TEXT[mode];
  const fieldId = (field: SupplierField) => `${mode}-supplier-${field}`;
  const summary: FormErrorItem[] = SUPPLIER_FIELDS.flatMap((field) => {
    const message = state.fieldErrors?.[field];
    return message ? [{ fieldId: fieldId(field), message }] : [];
  });
  const error = (field: SupplierField) => state.fieldErrors?.[field];
  // What the user typed after a failed save, else the stored values (edit), else empty.
  const value = (field: SupplierField) => state.values?.[field] ?? saved?.[field] ?? "";
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
            maxLength={SUPPLIER_LIMITS.name}
            defaultValue={value("name")}
            className={fieldControlClass}
          />
        )}
      </FormField>

      <CategoryFields
        fieldId={fieldId}
        category={value("category")}
        detail={value("categoryDetail")}
        categoryError={error("category")}
        detailError={error("categoryDetail")}
      />

      <fieldset className="flex flex-col gap-4" aria-describedby={`${mode}-supplier-contact-hint`}>
        <legend className="text-sm font-semibold">Contact (optional)</legend>
        <p id={`${mode}-supplier-contact-hint`} className="-mt-3 text-xs text-ink-3">
          Use the supplier&apos;s business contact details. Every member of the event can see them.
        </p>
        <FormField label="Contact person" id={fieldId("contactName")} error={error("contactName")}>
          {(control) => (
            <input
              {...control}
              name="contactName"
              type="text"
              autoComplete="off"
              maxLength={SUPPLIER_LIMITS.contactName}
              defaultValue={value("contactName")}
              className={fieldControlClass}
            />
          )}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Phone"
            id={fieldId("phone")}
            hint="For example 0917 123 4567."
            error={error("phone")}
          >
            {(control) => (
              <input
                {...control}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                maxLength={SUPPLIER_LIMITS.phone}
                defaultValue={value("phone")}
                className={fieldControlClass}
              />
            )}
          </FormField>
          <FormField label="Email" id={fieldId("email")} error={error("email")}>
            {(control) => (
              <input
                {...control}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                maxLength={SUPPLIER_LIMITS.email}
                defaultValue={value("email")}
                className={fieldControlClass}
              />
            )}
          </FormField>
        </div>
      </fieldset>

      <FormField
        label="Notes (optional)"
        id={fieldId("notes")}
        hint={`Anything the team needs to know, for example a tasting date. Every member of the event can see notes. ${limit(SUPPLIER_LIMITS.notes)}`}
        error={error("notes")}
      >
        {(control) => (
          <textarea
            {...control}
            name="notes"
            rows={4}
            maxLength={SUPPLIER_LIMITS.notes}
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

/** The category and, for Other, what the supplier provides (D-069). */
function CategoryFields({
  fieldId,
  category,
  detail,
  categoryError,
  detailError,
}: {
  fieldId: (field: SupplierField) => string;
  category: string;
  detail: string;
  categoryError?: string;
  detailError?: string;
}) {
  const [chosen, setChosen] = useState(category);
  const description = isSupplierCategory(chosen)
    ? SUPPLIER_CATEGORY_DEFINITIONS[chosen].description
    : "Choose what the supplier provides.";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        label="Category"
        id={fieldId("category")}
        hint={description}
        error={categoryError}
        required
      >
        {(control) => (
          <select
            {...control}
            name="category"
            defaultValue={category}
            onChange={(event) => setChosen(event.target.value)}
            className={fieldControlClass}
          >
            <option value="" disabled>
              Choose a category
            </option>
            {SUPPLIER_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {SUPPLIER_CATEGORY_DEFINITIONS[value].label}
              </option>
            ))}
          </select>
        )}
      </FormField>
      {chosen === "OTHER" ? (
        <FormField
          label="What they provide"
          id={fieldId("categoryDetail")}
          hint={`For example Fireworks. ${limit(SUPPLIER_LIMITS.categoryDetail)}`}
          error={detailError}
          required
        >
          {(control) => (
            <input
              {...control}
              name="categoryDetail"
              type="text"
              autoComplete="off"
              maxLength={SUPPLIER_LIMITS.categoryDetail}
              defaultValue={detail}
              className={fieldControlClass}
            />
          )}
        </FormField>
      ) : null}
    </div>
  );
}