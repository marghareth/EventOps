// src/modules/events/tasks/form-state.ts
// What the task server actions return to the forms, and every message they show (B6-F01 to B6-F05).
// Kept apart from actions.ts because a "use server" file may only export async functions.
import type { TaskField } from "./schema";

export type TaskFormState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<TaskField, string>>;
      values: Record<TaskField, string>;
    };

/** The answer of the delete action when it does not redirect (B6-F03). */
export type TaskDeleteState = { status: "idle" } | { status: "error"; message: string };

export const TASK_MESSAGES = {
  eventNotFound: "We couldn't find this event.",
  forbidden: "Only Owners and Coordinators can change tasks.",
  taskNotFound: "That task no longer exists. Go back to the tasks and try again.",
  taskStale:
    "Someone else changed this task while you were editing. Reopen it to see the latest values.",
  assigneeNotFound: "Choose a member of this event.",
  unchanged: "Nothing changed, so nothing was saved.",
  saveFailed: "We couldn't save your changes. Nothing was saved. Try again in a moment.",
  deleteFailed: "We couldn't delete the task. Nothing was removed. Try again in a moment.",
} as const;