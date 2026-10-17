// src/modules/events/tasks/application/update-task.ts
// Saves a task's title and description (B6-F02; D-094). A save that changes nothing is reported as
// "unchanged" and writes nothing, not even an audit entry. The repository refuses a stale save.
// The description is never copied into the audit log: the entry only says it changed.
import { diffTask, hasTaskChanges } from "../domain/task";
import type { TaskInput } from "../schema";
import type { TaskRepository } from "./ports";

export async function updateTask(
  repository: TaskRepository,
  args: {
    eventId: string;
    taskId: string;
    actorId: string;
    version: Date;
    input: TaskInput;
  },
) {
  const current = await repository.findTask(args.eventId, args.taskId);
  if (!current) return { ok: false, reason: "not-found" } as const;

  const changes = diffTask(current, args.input);
  if (!hasTaskChanges(changes)) return { ok: true, unchanged: true } as const;
  return repository.updateTask({ ...args, changes });
}