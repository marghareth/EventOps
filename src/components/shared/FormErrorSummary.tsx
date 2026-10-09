// src/components/shared/FormErrorSummary.tsx
"use client";

import { useEffect, useId, useRef } from "react";
import { StateIcon } from "./StateIcon";

export type FormErrorItem = {
  /** The id of the field control (see FormField's `id`). */
  fieldId: string;
  message: string;
};

type FormErrorSummaryProps = {
  errors: readonly FormErrorItem[];
  title?: string;
};

// Shown at the top of a form after a failed submit. Takes focus so keyboard and screen reader users
// land on it, and each item jumps to its field.
export function FormErrorSummary({
  errors,
  title = "Fix these to continue",
}: FormErrorSummaryProps) {
  const headingId = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Refocus only when the content changes, not on every render.
  const signature = errors.map((e) => `${e.fieldId}:${e.message}`).join("|");

  useEffect(() => {
    if (signature) ref.current?.focus();
  }, [signature]);

  if (errors.length === 0) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-labelledby={headingId}
      className="rounded-xl border border-critical-line bg-critical-tint p-4 text-ink"
    >
      <p id={headingId} className="flex items-center gap-2 font-semibold">
        <StateIcon name="error" className="text-critical" />
        {title}
      </p>
      <ul className="mt-2 list-disc pl-10">
        {errors.map((e) => (
          <li key={`${e.fieldId}:${e.message}`}>
            <a
              href={`#${e.fieldId}`}
              className="underline underline-offset-2"
              onClick={(event) => {
                const target = document.getElementById(e.fieldId);
                if (target) {
                  event.preventDefault();
                  target.focus();
                }
              }}
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}