// src/modules/events/suppliers/ui/PaymentForm.tsx
// The supplier payment form: adding and editing a deposit or payment (B4-14; D-077, D-079). The
// bound server action is passed in by the page; this component collects input and shows the
// server's answer. The server validates every value with the same schema for today in Manila and
// is the real check: the date limits here only help the browser's date picker.
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import {
  PAYMENT_KINDS,
  PAYMENT_KIND_DEFINITIONS,
  PAYMENT_RECORD_STATUSES,
  PAYMENT_RECORD_STATUS_DEFINITIONS,
} from "../payment-definitions";
import { PAYMENT_DATE_RANGE } from "../payment-due";
import { initialPaymentFormState, type PaymentFormState } from "../payment-form-state";
import { PAYMENT_FIELDS, PAYMENT_LIMITS, type PaymentField } from "../payment-schema";

type PaymentFormProps = {
  action: (state: PaymentFormState, formData: FormData) => Promise<PaymentFormState>;
  /** Where Cancel goes: the supplier's page. */
  cancelHref: string;
  /** Today in Manila ("YYYY-MM-DD"), from the server: the latest paid date. */
  today: string;
  /** "edit" needs `saved` (the stored values) and `version` (its updatedAt, D-032). */
  mode?: "add" | "edit";
  saved?: Record<PaymentField, string>;
  version?: string;
};

const TEXT = {
  add: { submit: "Add payment", busy: "Adding payment…", failed: "Couldn't add the payment" },
  edit: { submit: "Save changes", busy: "Saving changes…", failed: "Couldn't save the changes" },
} as const;

export function PaymentForm({
  action,
  cancelHref,
  today,
  mode = "add",
  saved,
  version,
}: PaymentFormProps) {
  const [state, formAction, pending] = useActionState(action, initialPaymentFormState);
  const text = TEXT[mode];
  const fieldId = (field: PaymentField) => `${mode}-payment-${field}`;
  const error = (field: PaymentField) => state.fieldErrors?.[field];
  const summary: FormErrorItem[] = PAYMENT_FIELDS.flatMap((field) => {
    const message = error(field);
    return message ? [{ fieldId: fieldId(field), message }] : [];
  });
  // What the user typed after a failed save, else the stored values (edit), else the defaults.
  const value = (field: PaymentField, fallback = "") =>
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

      <ChoiceFields fieldId={fieldId} value={value} error={error} today={today} />

      <FormField
        label="Description (optional)"
        id={fieldId("description")}
        hint={`For example "50% downpayment". Up to ${PAYMENT_LIMITS.description} characters.`}
        error={error("description")}
      >
        {(control) => (
          <input
            {...control}
            name="description"
            type="text"
            autoComplete="off"
            maxLength={PAYMENT_LIMITS.description}
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

type FieldProps = {
  fieldId: (field: PaymentField) => string;
  value: (field: PaymentField, fallback?: string) => string;
  error: (field: PaymentField) => string | undefined;
  today: string;
};

/**
 * Kind, amount, due date, status and paid date. Inside the form, so a server answer (which
 * re-mounts the form) also resets the chosen kind and status to what was sent back.
 */
function ChoiceFields({ fieldId, value, error, today }: FieldProps) {
  const [kind, setKind] = useState(value("kind", "DEPOSIT"));
  const [status, setStatus] = useState(value("status", "UNPAID"));
  const kindHint = PAYMENT_KIND_DEFINITIONS[kind as keyof typeof PAYMENT_KIND_DEFINITIONS];
  const statusHint =
    PAYMENT_RECORD_STATUS_DEFINITIONS[status as keyof typeof PAYMENT_RECORD_STATUS_DEFINITIONS];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Kind"
          id={fieldId("kind")}
          hint={kindHint?.description ?? "Choose deposit or payment."}
          error={error("kind")}
          required
        >
          {(control) => (
            <select
              {...control}
              name="kind"
              defaultValue={value("kind", "DEPOSIT")}
              onChange={(event) => setKind(event.target.value)}
              className={fieldControlClass}
            >
              {PAYMENT_KINDS.map((option) => (
                <option key={option} value={option}>
                  {PAYMENT_KIND_DEFINITIONS[option].label}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField
          label="Amount (₱)"
          id={fieldId("amount")}
          hint="In pesos, for example 49,500 or 49,500.50."
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
      </div>

      <FormField
        label="Due date"
        id={fieldId("dueDate")}
        hint="Philippine date. A date that has passed shows the payment as overdue until it's paid."
        error={error("dueDate")}
        required
      >
        {(control) => (
          <input
            {...control}
            name="dueDate"
            type="date"
            min={PAYMENT_DATE_RANGE.min}
            max={PAYMENT_DATE_RANGE.max}
            defaultValue={value("dueDate")}
            className={`${fieldControlClass} sm:max-w-60`}
          />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Status"
          id={fieldId("status")}
          hint={statusHint?.description ?? "Choose whether it has been paid."}
          error={error("status")}
          required
        >
          {(control) => (
            <select
              {...control}
              name="status"
              defaultValue={value("status", "UNPAID")}
              onChange={(event) => setStatus(event.target.value)}
              className={fieldControlClass}
            >
              {PAYMENT_RECORD_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {PAYMENT_RECORD_STATUS_DEFINITIONS[option].label}
                </option>
              ))}
            </select>
          )}
        </FormField>
        {status === "PAID" ? (
          <FormField
            label="Paid on"
            id={fieldId("paidOn")}
            hint="Philippine date. Today or earlier."
            error={error("paidOn")}
            required
          >
            {(control) => (
              <input
                {...control}
                name="paidOn"
                type="date"
                min={PAYMENT_DATE_RANGE.min}
                max={today}
                defaultValue={value("paidOn")}
                className={fieldControlClass}
              />
            )}
          </FormField>
        ) : null}
      </div>
    </>
  );
}