// src/modules/events/accessibility/ui/RadioOption.tsx
// Shared pieces of the accessibility forms (B3-04, B3-05): one radio choice with its description,
// and the error line under a radio group, matching FormField's error.
import { StateIcon } from "@/components/shared/StateIcon";

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-xs font-medium text-critical">
      <StateIcon name="error" className="mt-0.5 size-4" />
      <span>
        <span className="sr-only">Error: </span>
        {message}
      </span>
    </p>
  );
}

const optionClass =
  "flex min-h-11 items-start gap-3 rounded-md border border-line bg-white px-3.5 py-3 has-[:checked]:border-blue has-[:checked]:bg-blue-tint has-[:disabled]:bg-paper";

/**
 * One radio choice. The label holds only the choice's name and the description is linked with
 * aria-describedby, so screen readers say the name once and the description once.
 */
export function RadioOption(props: {
  id: string;
  name: string;
  value: string;
  label: string;
  description: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={optionClass}>
      <input
        id={props.id}
        type="radio"
        name={props.name}
        value={props.value}
        defaultChecked={props.defaultChecked}
        disabled={props.disabled}
        aria-describedby={`${props.id}-hint`}
        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-blue disabled:cursor-not-allowed"
      />
      <div className="flex flex-col">
        <label
          htmlFor={props.id}
          className={
            props.disabled ? "font-semibold text-ink-2" : "cursor-pointer font-semibold text-ink"
          }
        >
          {props.label}
        </label>
        <p id={`${props.id}-hint`} className="text-sm text-ink-2">
          {props.description}
        </p>
      </div>
    </div>
  );
}