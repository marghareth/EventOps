// src/modules/events/budget/ui/CategoryForm.tsx
// Add or edit a budget category (B5-F01; D-084). The server action re-validates everything; this
// form only shows its answer. Edit carries the version the page loaded (D-032) as a hidden field.
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategoryAction, updateCategoryAction } from "../actions";
import type { CategoryFormState } from "../form-state";
import { FormField } from "./FormField";

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

  return (
    <form action={formAction} noValidate className="flex max-w-xl flex-col gap-5">
      {category ? <input type="hidden" name="version" value={category.version} /> : null}

      {state.status === "error" && state.message ? (
        <p role="alert" className="rounded-lg border border-[#F2B8B8] bg-[#FBE9E9] p-3 text-sm">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="rounded-lg border border-[#B7CFF0] bg-[#E5ECFD] p-3 text-sm">
          {state.message}
        </p>
      ) : null}

      <FormField id="category-name" label="Category name" error={fieldErrors.name}>
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

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : category ? "Save category" : "Add category"}
        </Button>
        <Button asChild variant="secondary">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}