// src/modules/events/attendees/ui/RemoveAttendeeSection.tsx
// Remove attendee (B2-04): a destructive action behind a confirmation dialog. The page shows this
// only to roles that may manage attendees; the server action checks the role again (D-035, D-036).
// Cancel, Escape or closing the dialog removes nothing.
"use client";

import { startTransition, useActionState, useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StateIcon } from "@/components/shared/StateIcon";
import { Button } from "@/components/ui/button";
import { initialDeleteAttendeeState, type DeleteAttendeeFormState } from "../form-state";

type RemoveAttendeeSectionProps = {
  action: (state: DeleteAttendeeFormState, formData: FormData) => Promise<DeleteAttendeeFormState>;
  name: string;
  reference: string;
};

export function RemoveAttendeeSection({ action, name, reference }: RemoveAttendeeSectionProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialDeleteAttendeeState);

  return (
    <section
      aria-labelledby="remove-attendee-heading"
      className="mt-6 rounded-xl border border-critical-line bg-white p-6 shadow-xs sm:p-8"
    >
      <h2 id="remove-attendee-heading" className="text-h4 font-bold">
        Remove attendee
      </h2>
      <p className="mt-1 mb-4 text-sm text-ink-2">
        Permanently removes this guest and their details from the event. You can&apos;t undo this.
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Remove attendee
      </Button>

      <ConfirmDialog
        open={open}
        title="Remove this attendee?"
        description={
          <>
            <strong className="font-semibold text-ink">{name}</strong> (
            <span className="font-mono">{reference}</span>) will be removed from the guest list. You
            can&apos;t undo this.
          </>
        }
        confirmLabel="Remove attendee"
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