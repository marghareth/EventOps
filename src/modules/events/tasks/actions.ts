// src/modules/events/tasks/actions.ts
// Task server actions (B6-F01 create, B6-F02 edit, B6-F03 delete, B6-F04 assignee, B6-F05 priority;
// D-094, D-095). Server actions are public HTTP
// endpoints, so each one authorizes first with authorizeEvent(eventId, "tasks.manage") (D-035,
// D-036) and validates every input on the server with the shared schema. The event comes only from
// the bound argument and is checked; the task ID is looked up only inside the authorized event, so
// another event's task is "not found". An assignee is accepted only if it is a member of the
// authorized event. The repository re-checks the role in the database.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsFrom } from "@/lib/auth-rules";
import { authorizeEvent } from "@/modules/events/public";
import { createTask } from "./application/create-task";
import { deleteTask } from "./application/delete-task";
import { updateTask } from "./application/update-task";
import { taskRepository } from "./composition";
import { formatTaskReference } from "./domain/task";
import { TASK_MESSAGES as MESSAGES, type TaskDeleteState, type TaskFormState } from "./form-state";
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

/** A member ID that is not this event's: shown as an error on the assignee field (D-095). */
const assigneeRefused = (values: Record<TaskField, string>): TaskFormState => ({
  status: "error",
  fieldErrors: { assigneeId: MESSAGES.assigneeNotFound },
  values,
});

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
    if (!result.ok && result.reason === "assignee-not-found") return assigneeRefused(values);
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
    if (!result.ok && result.reason === "assignee-not-found") return assigneeRefused(values);
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

/**
 * Permanently removes a task, then opens the task list with a "removed" notice (B6-F03, D-095).
 * Owners and Coordinators. The task ID is looked up only inside the authorized event, so another
 * event's task is "not found"; a refusal removes nothing.
 */
export async function deleteTaskAction(eventId: string, taskId: string): Promise<TaskDeleteState> {
  const auth = await authorizeEvent(eventId, "tasks.manage", tasksPath(eventId));
  if (!auth.ok) return { status: "error", message: REFUSED[auth.reason] };
  if (!idSchema.safeParse(taskId).success) {
    return { status: "error", message: MESSAGES.taskNotFound };
  }
  let number: number;
  try {
    const result = await deleteTask(taskRepository(), {
      eventId: auth.event.id,
      taskId,
      actorId: auth.user.id,
    });
    if (!result.ok) return { status: "error", message: MESSAGES.taskNotFound };
    number = result.number;
  } catch {
    return { status: "error", message: MESSAGES.deleteFailed };
  }
  revalidatePath(tasksPath(auth.event.id));
  redirect(noticeUrl(auth.event.id, "task-removed", formatTaskReference(number)));
}