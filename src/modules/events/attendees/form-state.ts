// src/modules/events/attendees/form-state.ts
// State shared by attendee forms and their server actions (B2-01). Separate from actions.ts because
// a "use server" file may only export async functions.
import type { AttendeeField } from "./schema";

export type AttendeeFormState = {
  status: "idle" | "error" | "success";
  /** Form-level message, already safe to show. */
  message?: string;
  fieldErrors?: Partial<Record<AttendeeField, string>>;
  /** What the user typed, so a failed submit keeps it. */
  values?: Partial<Record<AttendeeField, string>>;
};

export const initialAttendeeFormState: AttendeeFormState = { status: "idle" };

/** Removing an attendee (B2-04). Success redirects, so only errors come back. */
export type DeleteAttendeeFormState = { status: "idle" | "error"; message?: string };

export const initialDeleteAttendeeState: DeleteAttendeeFormState = { status: "idle" };

/** Messages for attendee actions. Never include internal error details. */
export const ATTENDEE_MESSAGES = {
  saved: "Changes saved.",
  unchanged: "No changes to save.",
  forbidden: "Your role can view attendees but not change them. Ask an Owner or Coordinator.",
  eventNotFound: "This event isn't available. Go back to your events and open it again.",
  attendeeNotFound: "This attendee isn't available. They may have been removed.",
  stale:
    "This attendee changed since you opened them. Reload to see the latest details, then make your change again.",
  saveFailed: "We couldn't save the attendee. Try again in a moment.",
  deleteFailed: "We couldn't remove the attendee. Nothing was removed. Try again in a moment.",
} as const;