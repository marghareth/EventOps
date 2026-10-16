// src/modules/events/budget/ui/ItemForm.tsx
// Add or edit a budget item (B5-F02; D-085). The category picker lists only this event's
// categories, and the server action checks the choice again. Edit carries the loaded version
// (D-032) as a hidden field. No totals or statuses are shown here: those rules are not approved yet.
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createItemAction, updateItemAction } from "../actions";
import type { ItemFormState } from "../form-state";
import { FormField } from "./FormField";

type Props = {
  eventId: string;
  cancelHref: string;
  categories: { id: string; name: string }[];
  /** Pre-selected category when adding from a category's "Add item" link. */
  defaultCategoryId?: string;
  /** Omit to add an item. */
  item?: {
    id: string;
    reference: string;
    categoryId: string;
    name: string;
    estimated: string;
    committed: string;
    paid: string;
    notes: string | null;
    version: string;
  };
};

const IDLE: ItemFormState = { status: "idle" };

const CONTROL =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-base shadow-xs " +
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 " +
  "aria-invalid:border-[#C62828]";

export function ItemForm({ eventId, cancelHref, categories, defaultCategoryId, item }: Props) {
  const action = item
    ? updateItemAction.bind(null, eventId, item.id)
    : createItemAction.bind(null, eventId);
  const [state, formAction, pending] = useActionState(action, IDLE);

  const values =
    state.status === "error"
      ? state.values
      : {
          categoryId: item?.categoryId ?? defaultCategoryId ?? "",
          name: item?.name ?? "",
          estimated: item?.estimated ?? "",
          committed: item?.committed ?? "",
          paid: item?.paid ?? "",
          notes: item?.notes ?? "",
        };
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} noValidate className="flex max-w-xl flex-col gap-5">
      {item ? <input type="hidden" name="version" value={item.version} /> : null}

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

      {item ? (
        <p className="text-sm text-muted-foreground">
          Budget item <span className="font-mono">{item.reference}</span>
        </p>
      ) : null}

      <FormField id="item-category" label="Category" error={fieldErrors.categoryId}>
        {(control) => (
          <select {...control} name="categoryId" defaultValue={values.categoryId} className={CONTROL}>
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField id="item-name" label="Item name" error={fieldErrors.name}>
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
        id="item-estimated"
        label="Estimated (₱)"
        hint="What you expect this to cost."
        error={fieldErrors.estimated}
      >
        {(control) => (
          <Input
            {...control}
            name="estimated"
            defaultValue={values.estimated}
            inputMode="decimal"
            autoComplete="off"
            required
          />
        )}
      </FormField>

      <FormField
        id="item-committed"
        label="Committed (₱)"
        hint="What you have agreed to pay. Leave empty for ₱0.00."
        error={fieldErrors.committed}
      >
        {(control) => (
          <Input
            {...control}
            name="committed"
            defaultValue={values.committed}
            inputMode="decimal"
            autoComplete="off"
          />
        )}
      </FormField>

      <FormField
        id="item-paid"
        label="Paid (₱)"
        hint="What you have already paid. Leave empty for ₱0.00."
        error={fieldErrors.paid}
      >
        {(control) => (
          <Input
            {...control}
            name="paid"
            defaultValue={values.paid}
            inputMode="decimal"
            autoComplete="off"
          />
        )}
      </FormField>

      <FormField id="item-notes" label="Notes (optional)" error={fieldErrors.notes}>
        {(control) => (
          <textarea
            {...control}
            name="notes"
            defaultValue={values.notes}
            rows={4}
            maxLength={2000}
            className={CONTROL}
          />
        )}
      </FormField>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : item ? "Save item" : "Add item"}
        </Button>
        <Button asChild variant="secondary">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}