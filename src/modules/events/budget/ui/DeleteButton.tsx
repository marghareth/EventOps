// src/modules/events/budget/ui/DeleteButton.tsx
// A two-step delete for a category or an item (B5-F01, B5-F02): "Delete" asks, "Yes, delete"
// confirms. The server action does the work and redirects on success; a refusal (for example a
// category that still has items) is shown here and announced. Nothing is removed on a refusal.
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { DeleteFormState } from "../form-state";

export function DeleteButton({
  action,
  label,
}: {
  /** A server action already bound to its event and record. */
  action: () => Promise<DeleteFormState>;
  /** What is being deleted, for the accessible name, for example "BUD-0004 Venue deposit". */
  label: string;
}) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.status === "error") {
        setError(result.message);
        setAsking(false);
      }
    });
  }

  if (!asking) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button type="button" variant="secondary" size="sm" onClick={() => setAsking(true)}>
          <span aria-hidden="true">Delete</span>
          <span className="sr-only">Delete {label}</span>
        </Button>
        {error ? (
          <p role="alert" className="max-w-64 text-sm text-[#C62828]">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div role="group" aria-label={`Confirm deleting ${label}`} className="flex flex-wrap gap-2">
      <Button type="button" variant="destructive" size="sm" onClick={confirm} disabled={pending}>
        {pending ? "Deleting…" : "Yes, delete"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setAsking(false)}
        disabled={pending}
        autoFocus
      >
        Keep it
      </Button>
    </div>
  );
}