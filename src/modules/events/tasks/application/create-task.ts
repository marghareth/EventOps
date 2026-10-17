// src/modules/events/tasks/application/create-task.ts
// Adds a task to an event (B6-F01, B6-F04, B6-F05; D-094, D-095). The repository issues the TSK-
// number in the same transaction as the insert, re-checks the actor's role and checks that the
// assignee is a member of this event.
import type { TaskInput } from "../schema";
import type { TaskRepository } from "./ports";

export function createTask(
  repository: TaskRepository,
  args: { eventId: string; actorId: string; input: TaskInput },
) {
  return repository.createTask(args);
}