// src/modules/events/tasks/application/ports.ts
// What the task use cases need from storage (B6-F01, B6-F02; D-094). The Prisma repository
// implements it; tests use an in-memory fake.
import type { TaskChanges } from "@/modules/events/audit/public";
import type { TaskInput } from "../schema";

export type TaskRecord = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  /** The edit version (D-032). Sent back on save; an older value is refused as stale. */
  updatedAt: Date;
};

type Actor = { eventId: string; actorId: string };

export interface TaskRepository {
  listTasks(eventId: string): Promise<TaskRecord[]>;
  findTask(eventId: string, taskId: string): Promise<TaskRecord | null>;
  createTask(
    args: Actor & { input: TaskInput },
  ): Promise<{ ok: true; id: string; number: number } | { ok: false; reason: "not-found" }>;
  updateTask(
    args: Actor & { taskId: string; version: Date; input: TaskInput; changes: TaskChanges },
  ): Promise<{ ok: true } | { ok: false; reason: "stale" | "not-found" }>;
}