// src/modules/events/budget/ui/DeleteButton.tsx
// Deleting a budget category or item needs a confirmation (B5-F01, B5-F02; B10-F09, D-114): "Delete"
// opens the shared confirm dialog, which names the record and says it can't be undone. The server
// action does the work and redirects on success; a refusal (for example a category that still has
// items) is shown here and announced, and nothing is removed. The dialog is only the prompt: the
// action checks the role again.
"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { DeleteFormState } from "../form-state";

export function DeleteButton({
  action,
  kind,
  label,
}: {
  /** A server action already bound to its event and record. */
  action: () => Promise<DeleteFormState>;
  kind: "category" | "item";
  /** What is being deleted, for example "BUD-0004 Venue deposit" or "Catering". */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const what = kind === "category" ? `category ${label}` : label;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      // On success the action redirects, so a returned value is always a refusal.
      if (result?.status === "error") {
        setError(result.message);
        setOpen(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <span aria-hidden="true">Delete</span>
        <span className="sr-only">Delete {what}</span>
      </Button>
      {error ? (
        <p role="alert" className="max-w-64 text-sm text-critical">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={open}
        destructive
        pending={pending}
        title={kind === "category" ? `Delete the category ${label}?` : `Delete ${label}?`}
        description={
          kind === "category"
            ? "This permanently removes the category. A category that still has items can't be deleted. You can't undo this."
            : "This permanently removes the budget item and its amounts from the totals. You can't undo this."
        }
        confirmLabel={kind === "category" ? "Delete category" : "Delete item"}
        cancelLabel={kind === "category" ? "Keep category" : "Keep item"}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}