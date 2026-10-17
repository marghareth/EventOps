// src/modules/events/tasks/application/delete-task.ts
// Permanently removes a task (B6-F03; D-095). Its TSK- number is never reused. The repository
// re-checks the actor's role and records the deletion in the same transaction.
import type { TaskRepository } from "./ports";

export function deleteTask(
  repository: TaskRepository,
  args: { eventId: string; taskId: string; actorId: string },
) {
  return repository.deleteTask(args);
}