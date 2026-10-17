// src/modules/events/tasks/actions.ts
// Task server actions (B6-F01 create, B6-F02 edit; D-094). Server actions are public HTTP
// endpoints, so each one authorizes first with authorizeEvent(eventId, "tasks.manage") (D-035,
// D-036) and validates every input on the server with the shared schema. The event comes only from
// the bound argument and is checked; the task ID is looked up only inside the authorized event, so
// another event's task is "not found". The repository re-checks the role in the database.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsFrom } from "@/lib/auth-rules";
import { authorizeEvent } from "@/modules/events/public";
import { createTask } from "./application/create-task";
import { updateTask } from "./application/update-task";
import { taskRepository } from "./composition";
import { formatTaskReference } from "./domain/task";
import { TASK_MESSAGES as MESSAGES, type TaskFormState } from "./form-state";
import { TASK_FIELDS, taskFormSchema, type TaskField } from "./schema";

const idSchema = z.uuid();
const versionSchema = z.iso.datetime();

const REFUSED = { "not-found": MESSAGES.eventNotFound, forbidden: MESSAGES.forbidden } as const;

const tasksPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/tasks`;

/** The notice the task list shows after a change: a kind and the task's readable ID. */
const noticeUrl = (eventId: string, notice: string, ref: string) =>
  `${tasksPath(eventId)}?notice=${notice}&ref=${encodeURIComponent(ref)}`;

function taskValues(formData: FormData): Record<TaskField, string> {
  const values = {} as Record<TaskField, string>;
  for (const field of TASK_FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/** Adds a task, then opens the task list with an "added" notice (B6-F01). Owners and Coordinators. */
export async function createTaskAction(
  eventId: string,
  _previous: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const auth = await authorizeEvent(eventId, "tasks.manage", tasksPath(eventId));
  const values = taskValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };

  const parsed = taskFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  let number: number;
  try {
    const result = await createTask(taskRepository(), {
      eventId: auth.event.id,
      actorId: auth.user.id,
      input: parsed.data,
    });
    // The role changed after the check above: refused in the database.
    if (!result.ok) return { status: "error", message: MESSAGES.forbidden, values };
    number = result.number;
  } catch {
    // Database unreachable or a constraint failed: nothing was saved (one transaction).
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  revalidatePath(tasksPath(auth.event.id));
  // redirect() works by throwing, so it stays outside the try block.
  redirect(noticeUrl(auth.event.id, "task-added", formatTaskReference(number)));
}

/**
 * Saves a task's title and description, unless someone else saved it first (D-032), then opens the
 * task list with a "saved" notice. Nothing changed: says so and records nothing (B6-F02).
 */
export async function updateTaskAction(
  eventId: string,
  taskId: string,
  _previous: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const auth = await authorizeEvent(eventId, "tasks.manage", tasksPath(eventId));
  const values = taskValues(formData);
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason], values };
  if (!idSchema.safeParse(taskId).success) {
    return { status: "error", message: MESSAGES.taskNotFound, values };
  }
  const parsed = taskFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  const version = versionSchema.safeParse(formData.get("version"));
  if (!version.success) return { status: "error", message: MESSAGES.taskStale, values };

  let reference: string;
  try {
    const repository = taskRepository();
    const current = await repository.findTask(auth.event.id, taskId);
    if (!current) return { status: "error", message: MESSAGES.taskNotFound, values };
    reference = formatTaskReference(current.number);
    const result = await updateTask(repository, {
      eventId: auth.event.id,
      taskId,
      actorId: auth.user.id,
      version: new Date(version.data),
      input: parsed.data,
    });
    if (!result.ok) {
      const message = result.reason === "stale" ? MESSAGES.taskStale : MESSAGES.taskNotFound;
      return { status: "error", message, values };
    }
    if ("unchanged" in result) return { status: "success", message: MESSAGES.unchanged };
  } catch {
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  revalidatePath(tasksPath(auth.event.id));
  redirect(noticeUrl(auth.event.id, "task-saved", reference));
}