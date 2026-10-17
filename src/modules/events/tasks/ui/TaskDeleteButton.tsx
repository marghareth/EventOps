// src/modules/events/tasks/ui/TaskDeleteButton.tsx
// Deleting a task needs a confirmation (B6-F03; D-095): "Delete" opens the shared confirm dialog,
// which names the task and says it can't be undone. The server action does the work and redirects
// on success; a refusal is shown here and announced, and nothing is removed. The dialog is only the
// prompt: the action checks the role again.
"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { TaskDeleteState } from "../form-state";

export function TaskDeleteButton({
  action,
  reference,
  title,
}: {
  /** A server action already bound to its event and task. */
  action: () => Promise<TaskDeleteState>;
  reference: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = `${reference} ${title}`;

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
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">Delete</span>
        <span className="sr-only">Delete {label}</span>
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
        title={`Delete ${reference}?`}
        description={
          <>
            This permanently removes “{title}”. You can’t undo this, and the number {reference}{" "}
            won’t be used again.
          </>
        }
        confirmLabel="Delete task"
        cancelLabel="Keep task"
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}