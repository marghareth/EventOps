// src/modules/events/tasks/queries.ts
// Server-side task reads for the pages (B6-F01, B6-F02; D-094). Every read authorizes on its own
// with authorizeEvent (D-036) and looks records up only inside the authorized event, so another
// event's task is "not found". Stored values only.
import "server-only";
import { z } from "zod";
import { authorizeEvent } from "@/modules/events/public";
import type { TaskRecord } from "./application/ports";
import { taskRepository } from "./composition";

const idSchema = z.uuid();
const tasksPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/tasks`;

type Refused = { ok: false; reason: "not-found" | "forbidden" };

/** The event's tasks for the list page. Every member may read; canManage drives the buttons. */
export async function getEventTasks(
  eventId: string,
): Promise<{ ok: true; tasks: TaskRecord[]; canManage: boolean } | Refused> {
  const view = await authorizeEvent(eventId, "event.view", tasksPath(eventId));
  if (!view.ok) return { ok: false, reason: view.reason };
  const manage = await authorizeEvent(view.event.id, "tasks.manage", tasksPath(view.event.id));
  const tasks = await taskRepository().listTasks(view.event.id);
  return { ok: true, tasks, canManage: manage.ok };
}

/** One task for its edit form. Owners and Coordinators only. */
export async function getTaskForEdit(
  eventId: string,
  taskId: string,
): Promise<{ ok: true; task: TaskRecord } | Refused> {
  const auth = await authorizeEvent(eventId, "tasks.manage", tasksPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  if (!idSchema.safeParse(taskId).success) return { ok: false, reason: "not-found" };
  const task = await taskRepository().findTask(auth.event.id, taskId);
  return task ? { ok: true, task } : { ok: false, reason: "not-found" };
}