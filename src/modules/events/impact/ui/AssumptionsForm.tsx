// src/modules/events/impact/ui/AssumptionsForm.tsx
// The editable impact assumptions (B7-F12, B7-F15; D-102). Owners and Coordinators edit them here;
// everyone else sees them read-only (AssumptionsSummary). Every value is optional: blank means
// "not set", and the rule that needs it says so instead of guessing. The server action re-validates
// everything; after a failed save every problem is listed at once in a summary that takes focus.
"use client";

import { useActionState } from "react";
import { Banner } from "@/components/shared/Banner";
import { FormErrorSummary, type FormErrorItem } from "@/components/shared/FormErrorSummary";
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { saveAssumptionsAction } from "../actions";
import { ASSUMPTION_LABEL } from "../domain/assumptions";
import type { AssumptionFormField, AssumptionsFormState } from "../form-state";

const IDLE: AssumptionsFormState = { status: "idle" };

export type AssumptionsFormValues = {
  cateringCostPerHead: string | null;
  accessibleSeatsPer100: string | null;
  cateringCategoryId: string | null;
  version: string;
};

export function AssumptionsForm({
  eventId,
  current,
  categories,
  proposal,
}: {
  eventId: string;
  current: AssumptionsFormValues;
  categories: { id: string; name: string }[];
  /** The proposed number on screen, kept after saving. */
  proposal: number | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveAssumptionsAction.bind(null, eventId),
    IDLE,
  );
  const values: Record<AssumptionFormField, string> =
    state.status === "error"
      ? state.values
      : {
          cateringCostPerHead: current.cateringCostPerHead ?? "",
          accessibleSeatsPer100: current.accessibleSeatsPer100 ?? "",
          cateringCategoryId: current.cateringCategoryId ?? "",
        };
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const summary: FormErrorItem[] = [
    { fieldId: "impact-cost-per-head", message: fieldErrors.cateringCostPerHead },
    { fieldId: "impact-seat-ratio", message: fieldErrors.accessibleSeatsPer100 },
    { fieldId: "impact-catering-category", message: fieldErrors.cateringCategoryId },
  ].filter((entry): entry is FormErrorItem => Boolean(entry.message));
  const chosenMissing =
    values.cateringCategoryId !== "" &&
    !categories.some((category) => category.id === values.cateringCategoryId);

  return (
    <form
      key={JSON.stringify(values)}
      action={formAction}
      noValidate
      aria-busy={pending}
      className="flex w-full max-w-xl flex-col gap-5"
    >
      <FormErrorSummary errors={summary} />
      {state.status === "error" && state.message ? (
        <Banner severity="critical" title="Couldn't save the assumptions">
          {state.message}
        </Banner>
      ) : null}
      <input type="hidden" name="version" value={current.version} />
      {proposal !== null ? <input type="hidden" name="to" value={proposal} /> : null}

      <FormField
        id="impact-cost-per-head"
        label={`${ASSUMPTION_LABEL.cateringCostPerHead} (optional)`}
        hint="Pesos per person, from your catering quote. Leave it blank to skip the catering estimate."
        error={fieldErrors.cateringCostPerHead}
      >
        {(control) => (
          <input
            {...control}
            name="cateringCostPerHead"
            inputMode="decimal"
            autoComplete="off"
            placeholder="350.00"
            defaultValue={values.cateringCostPerHead}
            className={`${fieldControlClass} sm:max-w-60`}
          />
        )}
      </FormField>

      <FormField
        id="impact-seat-ratio"
        label={`${ASSUMPTION_LABEL.accessibleSeatsPer100} (optional)`}
        hint="From 0 to 100. Used only for an estimate; the needs recorded for your guests are always checked."
        error={fieldErrors.accessibleSeatsPer100}
      >
        {(control) => (
          <input
            {...control}
            name="accessibleSeatsPer100"
            inputMode="decimal"
            autoComplete="off"
            placeholder="2.5"
            defaultValue={values.accessibleSeatsPer100}
            className={`${fieldControlClass} sm:max-w-60`}
          />
        )}
      </FormField>

      <FormField
        id="impact-catering-category"
        label={`${ASSUMPTION_LABEL.cateringCategoryId} (optional)`}
        hint={
          categories.length === 0
            ? "This event has no budget categories yet. Only the whole budget is checked."
            : "The category the catering cost is charged to, so it is checked on its own as well."
        }
        error={fieldErrors.cateringCategoryId}
      >
        {(control) => (
          <select
            {...control}
            name="cateringCategoryId"
            defaultValue={chosenMissing ? "" : values.cateringCategoryId}
            className={fieldControlClass}
          >
            <option value="">None: check the whole budget only</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <div>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : "Save assumptions"}
        </Button>
      </div>
    </form>
  );
}