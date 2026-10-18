// src/modules/events/tasks/application/ports.ts
// What the task use cases need from storage (B6-F01 to B6-F07; D-094 to D-096). The Prisma repository
// implements it; tests use an in-memory fake.
import type { TaskChanges } from "@/modules/events/audit/public";
import type { TaskAssignee, TaskPriority, TaskStatus } from "../domain/task";
import type { TaskInput } from "../schema";

export type TaskRecord = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  /** The day it is due as "YYYY-MM-DD" (a calendar day in Philippine time), or null. */
  dueDate: string | null;
  /** The member the task is assigned to, or null when unassigned. */
  assignee: TaskAssignee | null;
  /** The edit version (D-032). Sent back on save; an older value is refused as stale. */
  updatedAt: Date;
};

/** A member of the event who can be given a task (D-095). Every role can be assigned. */
export type AssignableMember = {
  id: string;
  name: string;
  role: "OWNER" | "COORDINATOR" | "VIEWER";
};

type Actor = { eventId: string; actorId: string };

export interface TaskRepository {
  listTasks(eventId: string): Promise<TaskRecord[]>;
  findTask(eventId: string, taskId: string): Promise<TaskRecord | null>;
  /** The event's members, for the assignee choice. Only this event's: never another's. */
  listAssignableMembers(eventId: string): Promise<AssignableMember[]>;
  /** One member of this event, or null when the ID is not a member of it. */
  findAssignableMember(eventId: string, memberId: string): Promise<AssignableMember | null>;
  createTask(
    args: Actor & { input: TaskInput },
  ): Promise<
    | { ok: true; id: string; number: number }
    | { ok: false; reason: "not-found" | "assignee-not-found" }
  >;
  updateTask(
    args: Actor & { taskId: string; version: Date; input: TaskInput; changes: TaskChanges },
  ): Promise<{ ok: true } | { ok: false; reason: "stale" | "not-found" | "assignee-not-found" }>;
  /** Permanently removes the task and records the deletion in the same transaction (D-095). */
  deleteTask(
    args: Actor & { taskId: string },
  ): Promise<{ ok: true; number: number; title: string } | { ok: false; reason: "not-found" }>;
}