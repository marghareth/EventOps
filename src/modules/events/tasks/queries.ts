// src/modules/events/tasks/queries.ts
// Server-side task reads for the pages (B6-F01 to B6-F12; D-094 to D-099). Every read authorizes on its own
// with authorizeEvent (D-036) and looks records up only inside the authorized event, so another
// event's task is "not found". Stored values only.
import "server-only";
import { z } from "zod";
import { MEMBER_ROLE_LABEL, authorizeEvent } from "@/modules/events/public";
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

/** A member the form can assign a task to: the ID to send and the words to show (D-095). */
export type AssigneeOption = { id: string; label: string };

/** The members of this event, labelled with their role so two people with one name differ. */
async function assigneeOptions(eventId: string): Promise<AssigneeOption[]> {
  const members = await taskRepository().listAssignableMembers(eventId);
  return members.map((member) => ({
    id: member.id,
    label: `${member.name} (${MEMBER_ROLE_LABEL[member.role]})`,
  }));
}

/** The assignee choices for the add form. Owners and Coordinators only. */
export async function getAssigneeOptions(
  eventId: string,
): Promise<{ ok: true; assignees: AssigneeOption[] } | Refused> {
  const auth = await authorizeEvent(eventId, "tasks.manage", tasksPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  return { ok: true, assignees: await assigneeOptions(auth.event.id) };
}

/** One task for its edit form, with the assignee choices. Owners and Coordinators only. */
export async function getTaskForEdit(
  eventId: string,
  taskId: string,
): Promise<{ ok: true; task: TaskRecord; assignees: AssigneeOption[] } | Refused> {
  const auth = await authorizeEvent(eventId, "tasks.manage", tasksPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  if (!idSchema.safeParse(taskId).success) return { ok: false, reason: "not-found" };
  const task = await taskRepository().findTask(auth.event.id, taskId);
  if (!task) return { ok: false, reason: "not-found" };
  return { ok: true, task, assignees: await assigneeOptions(auth.event.id) };
}