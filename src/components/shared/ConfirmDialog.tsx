// src/components/shared/ConfirmDialog.tsx
"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  /** Name the action and the thing, for example "Delete this event?". */
  title: string;
  /** Say what will happen and whether it can be undone. */
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive actions use the danger button, role="alertdialog", and start focus on Cancel. */
  destructive?: boolean;
  /** True while the action runs. Locks both buttons and Escape so it cannot run twice. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// Controlled, built on the native <dialog>: focus is trapped, the page behind is inert,
// and Escape works with no extra dependency. The parent owns `open`:
//
//   const [open, setOpen] = useState(false);
//   <Button onClick={() => setOpen(true)}>Delete event</Button>
//   <ConfirmDialog open={open} onCancel={() => setOpen(false)} onConfirm={runDelete} ... />
//
// The dialog never closes itself. Close it from the parent after the server action succeeds.
// The dialog is only the prompt: the server action must still check authorization.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      (destructive ? cancelRef : confirmRef).current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, destructive]);

  // Close the native dialog if the component unmounts while open.
  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role={destructive ? "alertdialog" : "dialog"}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={pending || undefined}
      // Escape fires "cancel". Keep the dialog controlled by the parent.
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-[min(480px,calc(100%-2rem))] rounded-2xl border-0 bg-white p-0 text-ink shadow-lg backdrop:bg-ink/55"
    >
      <div className="p-7">
        <h2 id={titleId} className="text-h3 font-extrabold">
          {title}
        </h2>
        <div id={descriptionId} className="mt-2 text-ink-2">
          {description}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-3 px-7 pb-7">
        <Button ref={cancelRef} variant="outline" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button
          ref={confirmRef}
          variant={destructive ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Working…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}