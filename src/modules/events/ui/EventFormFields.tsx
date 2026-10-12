// src/modules/events/ui/EventFormFields.tsx
// The event detail fields, shared by Create Event (B1-02) and Edit Event (B1-05) so both forms show
// the same fields, hints and limits. Validation happens on the server (createEventFormSchema).
import { FormField, fieldControlClass } from "@/components/shared/FormField";
import type { CreateEventField } from "../form-state";
import { EVENT_LIMITS } from "../schema";

type EventFormFieldsProps = {
  /** Prefix for control ids, so the error summary can link to each field. */
  idPrefix: string;
  value: (field: CreateEventField) => string;
  error: (field: CreateEventField) => string | undefined;
};

export function eventFieldId(idPrefix: string, field: CreateEventField): string {
  return `${idPrefix}-${field}`;
}

export function EventFormFields({ idPrefix, value, error }: EventFormFieldsProps) {
  const fieldId = (field: CreateEventField) => eventFieldId(idPrefix, field);
  return (
    <>
      <FormField label="Event name" id={fieldId("name")} error={error("name")} required>
        {(control) => (
          <input
            {...control}
            name="name"
            type="text"
            autoComplete="off"
            defaultValue={value("name")}
            className={fieldControlClass}
          />
        )}
      </FormField>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">When</legend>
        <p id={`${idPrefix}-when-hint`} className="text-xs text-ink-3">
          Philippine time (PHT). The end time is on the same day.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Date" id={fieldId("date")} error={error("date")} required>
            {(control) => (
              <input
                {...control}
                name="date"
                type="date"
                defaultValue={value("date")}
                className={fieldControlClass}
              />
            )}
          </FormField>
          <FormField
            label="Start time"
            id={fieldId("startTime")}
            error={error("startTime")}
            required
          >
            {(control) => (
              <input
                {...control}
                name="startTime"
                type="time"
                defaultValue={value("startTime")}
                className={fieldControlClass}
              />
            )}
          </FormField>
          <FormField label="End time (optional)" id={fieldId("endTime")} error={error("endTime")}>
            {(control) => (
              <input
                {...control}
                name="endTime"
                type="time"
                defaultValue={value("endTime")}
                className={fieldControlClass}
              />
            )}
          </FormField>
        </div>
      </fieldset>

      <FormField
        label="Venue (optional)"
        id={fieldId("venue")}
        hint={`Up to ${EVENT_LIMITS.venue} characters.`}
        error={error("venue")}
      >
        {(control) => (
          <input
            {...control}
            name="venue"
            type="text"
            defaultValue={value("venue")}
            className={fieldControlClass}
          />
        )}
      </FormField>

      <FormField
        label="Description (optional)"
        id={fieldId("description")}
        hint="Anything the team should know about this event."
        error={error("description")}
      >
        {(control) => (
          <textarea
            {...control}
            name="description"
            rows={4}
            defaultValue={value("description")}
            className={`${fieldControlClass} py-3`}
          />
        )}
      </FormField>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Numbers (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Venue capacity"
            id={fieldId("capacity")}
            hint="Seats the venue can hold."
            error={error("capacity")}
          >
            {(control) => (
              <input
                {...control}
                name="capacity"
                type="text"
                inputMode="numeric"
                defaultValue={value("capacity")}
                className={fieldControlClass}
              />
            )}
          </FormField>
          <FormField
            label="Expected attendees"
            id={fieldId("expectedAttendees")}
            hint="Your planning estimate. You can change it later."
            error={error("expectedAttendees")}
          >
            {(control) => (
              <input
                {...control}
                name="expectedAttendees"
                type="text"
                inputMode="numeric"
                defaultValue={value("expectedAttendees")}
                className={fieldControlClass}
              />
            )}
          </FormField>
        </div>
      </fieldset>
    </>
  );
}