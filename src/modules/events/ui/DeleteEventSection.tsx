// src/modules/events/ui/DeleteEventSection.tsx
// Delete Event (B1-06): a destructive confirmation that needs the event number typed in. The page
// shows this only to roles that may delete; the server action checks the role and the typed
// number again (D-033).
"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StateIcon } from "@/components/shared/StateIcon";
import { fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { initialDeleteEventState, type DeleteEventFormState } from "../form-state";

type DeleteEventSectionProps = {
  action: (state: DeleteEventFormState, formData: FormData) => Promise<DeleteEventFormState>;
  name: string;
  reference: string;
};

export function DeleteEventSection({ action, name, reference }: DeleteEventSectionProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction, pending] = useActionState(action, initialDeleteEventState);
  const inputId = useId();
  const errorId = useId();
  const matches = typed.trim() === reference;

  function close() {
    setOpen(false);
    setTyped("");
  }

  function confirm() {
    const formData = new FormData();
    formData.set("confirmation", typed);
    startTransition(() => formAction(formData));
  }

  return (
    <section
      aria-labelledby="delete-event-heading"
      className="rounded-xl border border-critical-line bg-white p-6 shadow-xs sm:p-8"
    >
      <h2 id="delete-event-heading" className="text-h4 font-bold">
        Delete event
      </h2>
      <p className="mt-1 mb-4 text-sm text-ink-2">
        Permanently removes this event and everything in it for every member. You can&apos;t undo
        this.
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete event
      </Button>

      <ConfirmDialog
        open={open}
        title="Delete this event?"
        description={
          <>
            <strong className="font-semibold text-ink">{name}</strong> (
            <span className="font-mono">{reference}</span>) and all of its data will be deleted for
            every member. You can&apos;t undo this.
          </>
        }
        confirmLabel="Delete event"
        destructive
        pending={pending}
        confirmDisabled={!matches}
        onConfirm={confirm}
        onCancel={close}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm font-semibold">
            Type <span className="font-mono">{reference}</span> to confirm
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={state.status === "error" ? errorId : undefined}
            aria-invalid={state.status === "error" ? true : undefined}
            className={`${fieldControlClass} font-mono`}
          />
          {state.status === "error" && state.message ? (
            <p
              id={errorId}
              role="alert"
              className="flex items-start gap-1.5 text-sm font-medium text-critical"
            >
              <StateIcon name="error" className="mt-0.5 size-4" />
              <span>{state.message}</span>
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </section>
  );
}