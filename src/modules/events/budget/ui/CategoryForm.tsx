// src/modules/events/budget/ui/CategoryForm.tsx
// Add or edit a budget category (B5-F01; D-084). The server action re-validates everything; this
// form only shows its answer. Edit carries the version the page loaded (D-032) as a hidden field.
// After a failed save every problem is listed at once in a summary that takes focus, and each line
// jumps to its field (B5-F15). On a phone the buttons fill the width (B5-F16).
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { FormField } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategoryAction, updateCategoryAction } from "../actions";
import type { CategoryFormState } from "../form-state";

type Props = {
  eventId: string;
  cancelHref: string;
  /** Omit to add a category. */
  category?: { id: string; name: string; allocation: string; version: string };
};

const IDLE: CategoryFormState = { status: "idle" };

export function CategoryForm({ eventId, cancelHref, category }: Props) {
  const action = category
    ? updateCategoryAction.bind(null, eventId, category.id)
    : createCategoryAction.bind(null, eventId);
  const [state, formAction, pending] = useActionState(action, IDLE);

  const values =
    state.status === "error"
      ? state.values
      : { name: category?.name ?? "", allocation: category?.allocation ?? "" };
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const summary: FormErrorItem[] = [
    { fieldId: "category-name", message: fieldErrors.name },
    { fieldId: "category-allocation", message: fieldErrors.allocation },
  ].filter((item): item is FormErrorItem => Boolean(item.message));

  return (
    <form
      action={formAction}
      noValidate
      aria-busy={pending}
      className="flex w-full max-w-xl flex-col gap-5"
    >
      <FormErrorSummary errors={summary} />
      {category ? <input type="hidden" name="version" value={category.version} /> : null}

      {state.status === "error" && state.message ? (
        <Banner severity="critical" title="Couldn't save the category">
          {state.message}
        </Banner>
      ) : null}
      {state.status === "success" ? <Banner severity="info" title={state.message} /> : null}

      <FormField required id="category-name" label="Category name" error={fieldErrors.name}>
        {(control) => (
          <Input
            {...control}
            name="name"
            defaultValue={values.name}
            maxLength={120}
            autoComplete="off"
            required
          />
        )}
      </FormField>

      <FormField
        required
        id="category-allocation"
        label="Allocation (₱)"
        hint="The amount you set aside for this category. Use 0 if you haven't decided."
        error={fieldErrors.allocation}
      >
        {(control) => (
          <Input
            {...control}
            name="allocation"
            defaultValue={values.allocation}
            inputMode="decimal"
            autoComplete="off"
            required
          />
        )}
      </FormField>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : category ? "Save category" : "Add category"}
        </Button>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}