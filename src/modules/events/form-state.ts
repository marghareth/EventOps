// src/modules/events/form-state.ts
// State shared by the Create Event form and its server action. Separate from actions.ts because a
// "use server" file may only export async functions.

export type CreateEventField =
  | "name"
  | "date"
  | "startTime"
  | "endTime"
  | "venue"
  | "description"
  | "capacity"
  | "expectedAttendees";

export type CreateEventFormState = {
  status: "idle" | "error";
  /** Form-level message, already safe to show. */
  message?: string;
  fieldErrors?: Partial<Record<CreateEventField, string>>;
  /** What the user typed, so a failed submit keeps it. */
  values?: Partial<Record<CreateEventField, string>>;
};

export const initialCreateEventState: CreateEventFormState = { status: "idle" };

export const CREATE_EVENT_FIELDS: readonly CreateEventField[] = [
  "name",
  "date",
  "startTime",
  "endTime",
  "venue",
  "description",
  "capacity",
  "expectedAttendees",
];

/** Form-level messages. Never include internal error details. */
export const CREATE_EVENT_MESSAGES = {
  saveFailed: "We couldn't save the event. Try again in a moment.",
  noDatabase:
    "Demo sign-in has no database to save to. Set DATABASE_URL in .env.local to create events.",
} as const;