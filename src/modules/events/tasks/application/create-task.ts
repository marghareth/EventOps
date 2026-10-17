// src/modules/events/tasks/application/create-task.ts
// Adds a task to an event (B6-F01; D-094). The repository issues the TSK- number in the same
// transaction as the insert and re-checks the actor's role.
import type { TaskInput } from "../schema";
import type { TaskRepository } from "./ports";

export function createTask(
  repository: TaskRepository,
  args: { eventId: string; actorId: string; input: TaskInput },
) {
  return repository.createTask(args);
}