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

/** Edit Event (B1-05): like Create Event, plus a success state shown after saving. */
export type EditEventFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<CreateEventField, string>>;
  values?: Partial<Record<CreateEventField, string>>;
};

export const initialEditEventState: EditEventFormState = { status: "idle" };

export const EDIT_EVENT_MESSAGES = {
  saved: "Changes saved.",
  unchanged: "No changes to save.",
  stale:
    "This event changed since you opened it. Reload the page to see the latest details, then make your change again.",
  forbidden: "Your role can view this event but not edit it. Ask an Owner or Coordinator.",
  notFound: "This event isn't available. Go back to your events and open it again.",
  saveFailed: "We couldn't save your changes. Try again in a moment.",
  noDatabase:
    "Demo sign-in has no database to save to. Set DATABASE_URL in .env.local to edit events.",
} as const;

/** Delete Event (B1-06). Success redirects, so only errors come back. */
export type DeleteEventFormState = { status: "idle" | "error"; message?: string };

export const initialDeleteEventState: DeleteEventFormState = { status: "idle" };

export const DELETE_EVENT_MESSAGES = {
  confirmation: "Type the event number exactly as shown to confirm.",
  forbidden: "Only the event's Owner can delete it.",
  notFound: "This event isn't available. It may already have been deleted.",
  failed: "We couldn't delete the event. Nothing was removed. Try again in a moment.",
  noDatabase: "Demo sign-in has no database. Set DATABASE_URL in .env.local to delete events.",
} as const;