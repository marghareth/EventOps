// src/modules/events/suppliers/ui/QuoteForm.tsx
// The quote form: adding (B4-09) and editing (B4-10) a supplier's quote. The bound server action is
// passed in by the page; this component collects input and shows the server's answer. The server
// validates every value (quoteFormSchema) and is the real check: amounts in pesos with at most two
// decimals (D-075), the canonical statuses (D-076).
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { initialQuoteFormState, type QuoteFormState } from "../quote-form-state";
import { QUOTE_FIELDS, QUOTE_LIMITS, type QuoteField } from "../quote-schema";
import { QUOTE_STATUSES, QUOTE_STATUS_DEFINITIONS, isQuoteStatus } from "../quote-statuses";

type QuoteFormProps = {
  action: (state: QuoteFormState, formData: FormData) => Promise<QuoteFormState>;
  /** Where Cancel goes: the supplier's page. */
  cancelHref: string;
  /** "edit" needs `saved` (the stored values) and `version` (its updatedAt, D-032). */
  mode?: "add" | "edit";
  saved?: Record<QuoteField, string>;
  version?: string;
};

const TEXT = {
  add: { submit: "Add quote", busy: "Adding quote…", failed: "Couldn't add the quote" },
  edit: { submit: "Save changes", busy: "Saving changes…", failed: "Couldn't save the changes" },
} as const;

export function QuoteForm({ action, cancelHref, mode = "add", saved, version }: QuoteFormProps) {
  const [state, formAction, pending] = useActionState(action, initialQuoteFormState);
  const text = TEXT[mode];
  const fieldId = (field: QuoteField) => `${mode}-quote-${field}`;
  const error = (field: QuoteField) => state.fieldErrors?.[field];
  const summary: FormErrorItem[] = QUOTE_FIELDS.flatMap((field) => {
    const message = error(field);
    return message ? [{ fieldId: fieldId(field), message }] : [];
  });
  // What the user typed after a failed save, else the stored values (edit), else the defaults.
  const value = (field: QuoteField, fallback = "") =>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Amount (₱)"
          id={fieldId("amount")}
          hint="In pesos, for example 120,000 or 120,000.50."
          error={error("amount")}
          required
        >
          {(control) => (
            <input
              {...control}
              name="amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              maxLength={20}
              defaultValue={value("amount")}
              className={`${fieldControlClass} tabular-nums`}
            />
          )}
        </FormField>
        <StatusField
          id={fieldId("status")}
          status={value("status", "PENDING")}
          error={error("status")}
        />
      </div>

      <FormField
        label="Description (optional)"
        id={fieldId("description")}
        hint={`Tells this supplier's quotes apart, for example "Package B, 200 guests". Up to ${QUOTE_LIMITS.description} characters.`}
        error={error("description")}
      >
        {(control) => (
          <input
            {...control}
            name="description"
            type="text"
            autoComplete="off"
            maxLength={QUOTE_LIMITS.description}
            defaultValue={value("description")}
            className={fieldControlClass}
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

/** The canonical statuses (D-076), with the chosen one's meaning as the hint. */
function StatusField({ id, status, error }: { id: string; status: string; error?: string }) {
  const [chosen, setChosen] = useState(status);
  const description = isQuoteStatus(chosen)
    ? QUOTE_STATUS_DEFINITIONS[chosen].description
    : "Choose the quote's status.";
  return (
    <FormField label="Status" id={id} hint={description} error={error} required>
      {(control) => (
        <select
          {...control}
          name="status"
          defaultValue={status}
          onChange={(event) => setChosen(event.target.value)}
          className={fieldControlClass}
        >
          {QUOTE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {QUOTE_STATUS_DEFINITIONS[value].label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}