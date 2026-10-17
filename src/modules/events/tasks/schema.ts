// src/modules/events/tasks/schema.ts
// Zod schema for the task form (B6-F01, B6-F02; D-094). The server actions parse the raw FormData
// strings with it on every request; the browser never decides what is valid. A blank description
// leaves as null.
import { z } from "zod";
import { TASK_DESCRIPTION_MAX, TASK_TITLE_MAX } from "./domain/task";

export const TASK_FIELDS = ["title", "description"] as const;
export type TaskField = (typeof TASK_FIELDS)[number];

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a task title.")
    .max(TASK_TITLE_MAX, `Keep the title to ${TASK_TITLE_MAX} characters or fewer.`),
  description: z
    .string()
    .trim()
    .max(
      TASK_DESCRIPTION_MAX,
      `Keep the description to ${TASK_DESCRIPTION_MAX} characters or fewer.`,
    )
    .transform((value) => (value === "" ? null : value)),
});
export type TaskInput = z.infer<typeof taskFormSchema>;