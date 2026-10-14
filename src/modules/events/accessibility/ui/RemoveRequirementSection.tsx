// src/modules/events/accessibility/ui/RemoveRequirementSection.tsx
// Remove an accessibility need (B3-04): a destructive action behind the shared confirmation dialog,
// starting on Cancel. The page shows this only to roles that may manage accessibility; the server
// action checks the role again (D-035, D-036). Cancel, Escape or closing the dialog removes nothing.
"use client";

import { startTransition, useActionState, useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StateIcon } from "@/components/shared/StateIcon";
import { Button } from "@/components/ui/button";
import { initialRemoveState, type RemoveFormState } from "../form-state";

type Props = {
  action: (state: RemoveFormState, formData: FormData) => Promise<RemoveFormState>;
  /** The need's label, for example "Accessible seating". */
  label: string;
  attendeeName: string;
};

export function RemoveRequirementSection({ action, label, attendeeName }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialRemoveState);

  return (
    <section
      aria-labelledby="remove-requirement-heading"
      className="mt-6 rounded-xl border border-critical-line bg-white p-6 shadow-xs sm:p-8"
    >
      <h2 id="remove-requirement-heading" className="text-h4 font-bold">
        Remove this need
      </h2>
      <p className="mt-1 mb-4 text-sm text-ink-2">
        Permanently removes it from this guest. You can&apos;t undo this.
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Remove need
      </Button>

      <ConfirmDialog
        open={open}
        title="Remove this accessibility need?"
        description={
          <>
            <strong className="font-semibold text-ink">{label}</strong> will be removed from{" "}
            {attendeeName}&apos;s accessibility needs. You can&apos;t undo this.
          </>
        }
        confirmLabel="Remove need"
        destructive
        pending={pending}
        onConfirm={() => startTransition(() => formAction(new FormData()))}
        onCancel={() => setOpen(false)}
      >
        {state.status === "error" && state.message ? (
          <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-critical">
            <StateIcon name="error" className="mt-0.5 size-4" />
            <span>{state.message}</span>
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}