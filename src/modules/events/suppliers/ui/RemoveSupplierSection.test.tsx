// src/modules/events/suppliers/ui/RemoveSupplierSection.tsx
// Remove supplier (B4-05, D-072): a destructive action behind a confirmation dialog, on the edit
// page. The page shows this only to roles that may manage suppliers; the server action checks the
// role again (D-035, D-036). Cancel, Escape or closing the dialog removes nothing.
"use client";

import { startTransition, useActionState, useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StateIcon } from "@/components/shared/StateIcon";
import { Button } from "@/components/ui/button";
import { initialDeleteSupplierState, type DeleteSupplierFormState } from "../form-state";

type RemoveSupplierSectionProps = {
  action: (state: DeleteSupplierFormState, formData: FormData) => Promise<DeleteSupplierFormState>;
  name: string;
  reference: string;
};

export function RemoveSupplierSection({ action, name, reference }: RemoveSupplierSectionProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialDeleteSupplierState);

  return (
    <section
      aria-labelledby="remove-supplier-heading"
      className="mt-6 rounded-xl border border-critical-line bg-white p-6 shadow-xs sm:p-8"
    >
      <h2 id="remove-supplier-heading" className="text-h4 font-bold">
        Remove supplier
      </h2>
      <p className="mt-1 mb-4 text-sm text-ink-2">
        Permanently removes this supplier and their contact details from the event. Activity keeps a
        note that they were removed. You can&apos;t undo this.
      </p>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Remove supplier
      </Button>

      <ConfirmDialog
        open={open}
        title="Remove this supplier?"
        description={
          <>
            <strong className="font-semibold text-ink">{name}</strong> (
            <span className="font-mono">{reference}</span>) will be removed from the supplier list.
            You can&apos;t undo this.
          </>
        }
        confirmLabel="Remove supplier"
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