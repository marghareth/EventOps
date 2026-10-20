// src/modules/events/impact/ui/ImpactSimulator.tsx
// The proposed change (B7-F02, B7-F15, B7-F17; D-101). A plain GET form: the number goes into the
// address, so the analysis is server-rendered, works without JavaScript, survives a reload and can
// be shared. The server validates it; this form only shows its answer.
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";

export function ImpactSimulator({
  action,
  current,
  value,
  error,
}: {
  /** The Impact page's own path. */
  action: string;
  current: number;
  /** What the user last entered, or "". */
  value: string;
  error?: string;
}) {
  return (
    <form method="get" action={action} noValidate className="flex w-full max-w-xl flex-col gap-4">
      <FormField
        id="impact-to"
        label="Proposed expected attendees"
        required
        hint={`Now ${current.toLocaleString("en-US")}. A whole number from 0 to 1,000,000.`}
        error={error}
      >
        {(control) => (
          <input
            {...control}
            name="to"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={value}
            maxLength={9}
            className={`${fieldControlClass} sm:max-w-60`}
          />
        )}
      </FormField>
      <div>
        <Button type="submit" className="w-full sm:w-auto">
          See the impact
        </Button>
      </div>
    </form>
  );
}