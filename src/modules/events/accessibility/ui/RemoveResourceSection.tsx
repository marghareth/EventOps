// src/modules/events/accessibility/ui/RemoveResourceSection.tsx
// Remove an event accessibility resource (B3-05) behind the shared confirmation dialog: the type
// shows as "Not set up" again. The page shows this only to roles that may manage accessibility;
// the server action checks the role again. Cancel, Escape or closing the dialog removes nothing.
"use client";

import { startTransition, useActionState, useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StateIcon } from "@/components/shared/StateIcon";
import { Button } from "@/components/ui/button";
import { initialRemoveState, type RemoveFormState } from "../form-state";

type Props = {
  action: (state: RemoveFormState, formData: FormData) => Promise<RemoveFormState>;
  /** The resource's label, for example "Ramp or elevator". */
  label: string;
};

export function RemoveResourceSection({ action, label }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialRemoveState);

  return (
    <section
      aria-labelledby="remove-resource-heading"
      className="mt-6 rounded-xl border border-critical-line bg-white p-6 shadow-xs sm:p-8"
    >
      <h2 id="remove-resource-heading" className="text-h4 font-bold">
        Remove this resource
      </h2>
      <p className="mt-1 mb-4 text-sm text-ink-2">
        It will show as Not set up again. You can&apos;t undo this.
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Remove resource
      </Button>

      <ConfirmDialog
        open={open}
        title="Remove this resource?"
        description={
          <>
            <strong className="font-semibold text-ink">{label}</strong> will show as Not set up
            again. You can&apos;t undo this.
          </>
        }
        confirmLabel="Remove resource"
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