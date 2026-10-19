// src/modules/events/tasks/schema.ts
// Zod schema for the task form (B6-F01 to B6-F07, B6-F13; D-094 to D-100). The server actions
// parse the raw FormData strings with it on every request; the browser never decides what is valid.
// A blank description leaves as null; a blank assignee means "unassigned" and leaves as null. That
// the assignee belongs to this event is checked against storage, not here.
import { z } from "zod";
import {
  TASK_DESCRIPTION_MAX,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TITLE_MAX,
} from "./domain/task";
import {
  TASK_DUE_DATE_RANGE,
  formatCalendarDate,
  isCalendarDate,
  isDueDateInRange,
} from "./domain/due-date";

export const TASK_FIELDS = [
  "title",
  "description",
  "priority",
  "status",
  "dueDate",
  "assigneeId",
] as const;
export type TaskField = (typeof TASK_FIELDS)[number];

const uuid = z.uuid();

/** A NUL character can't be stored in PostgreSQL text: refuse it clearly, as elsewhere (B3-19, D-100). */
const noNul = (value: string) => !value.includes("\u0000");
const NUL_MESSAGE = "Remove the invisible character this text contains, then try again.";
const RANGE_MESSAGE = `Enter a date from ${formatCalendarDate(TASK_DUE_DATE_RANGE.min)} to ${formatCalendarDate(TASK_DUE_DATE_RANGE.max)}.`;

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a task title.")
    .refine(noNul, NUL_MESSAGE)
    .max(TASK_TITLE_MAX, `Keep the title to ${TASK_TITLE_MAX} characters or fewer.`),
  description: z
    .string()
    .trim()
    .refine(noNul, NUL_MESSAGE)
    .max(
      TASK_DESCRIPTION_MAX,
      `Keep the description to ${TASK_DESCRIPTION_MAX} characters or fewer.`,
    )
    .transform((value) => (value === "" ? null : value)),
  priority: z.enum(TASK_PRIORITIES, { error: "Choose a priority." }),
  status: z.enum(TASK_STATUSES, { error: "Choose a status." }),
  dueDate: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (value === "") return;
      if (!isCalendarDate(value)) {
        ctx.addIssue({ code: "custom", message: "Enter a real date, for example 2026-11-15." });
      } else if (!isDueDateInRange(value)) {
        ctx.addIssue({ code: "custom", message: RANGE_MESSAGE });
      }
    })
    .transform((value) => (value === "" ? null : value)),
  assigneeId: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || uuid.safeParse(value).success,
      "Choose a member of this event.",
    )
    .transform((value) => (value === "" ? null : value)),
});
export type TaskInput = z.infer<typeof taskFormSchema>;