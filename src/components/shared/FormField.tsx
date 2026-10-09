// src/components/shared/FormField.tsx
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StateIcon } from "./StateIcon";

export type FieldControlProps = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  "aria-required": true | undefined;
};

// Design system input: 44 px, 12 px radius, white field. aria-invalid turns it critical, so the
// error state follows the real accessibility state. Put this on your input, select or textarea.
export const fieldControlClass =
  "min-h-11 w-full rounded-md border-[1.5px] border-line bg-field px-3.5 text-base text-ink placeholder:text-ink-3 hover:border-stone focus:border-blue aria-invalid:border-critical aria-invalid:bg-critical-tint disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-3";

type FormFieldProps = {
  label: string;
  /** Stable id so FormErrorSummary can link to the control. Generated when omitted. */
  id?: string;
  hint?: ReactNode;
  /** Message from server-side validation. The field is invalid when this is set. */
  error?: string;
  required?: boolean;
  className?: string;
  /** Spread the given props onto your input, select or textarea. */
  children: (control: FieldControlProps) => ReactNode;
};

// Wires label, hint and error to the control with ids, so screen readers read them with the field.
// The error shows an icon and the word "Error", so it never relies on color alone.
export function FormField({
  label,
  id,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={controlId} className="text-sm font-semibold text-ink">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
      {children({
        id: controlId,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-xs font-medium text-critical">
          <StateIcon name="error" className="mt-0.5 size-4" />
          <span>
            <span className="sr-only">Error: </span>
            {error}
          </span>
        </p>
      ) : null}
    </div>
  );
}