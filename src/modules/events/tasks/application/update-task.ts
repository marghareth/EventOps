// src/modules/events/tasks/application/update-task.ts
// Saves a task's title, description, priority, status, due date and assignee (B6-F02, B6-F04 to
// B6-F07; D-094 to D-096).
// A save that changes nothing is reported as "unchanged" and writes nothing, not even an audit
// entry. The repository refuses a stale save. The description is never copied into the audit log:
// the entry only says it changed. A new assignee must be a member of THIS event: a member ID from
// another event is "assignee not found", and the database's composite key refuses it again.
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

  let assignee = null;
  if (args.input.assigneeId !== null) {
    // Keeping the current assignee needs no lookup: they are already this event's member. A
    // different one is looked up inside the event.
    if (current.assignee?.id === args.input.assigneeId) {
      assignee = current.assignee;
    } else {
      const member = await repository.findAssignableMember(args.eventId, args.input.assigneeId);
      if (!member) return { ok: false, reason: "assignee-not-found" } as const;
      assignee = { id: member.id, name: member.name };
    }
  }

  const changes = diffTask(current, {
    title: args.input.title,
    description: args.input.description,
    priority: args.input.priority,
    status: args.input.status,
    dueDate: args.input.dueDate,
    assignee,
  });
  if (!hasTaskChanges(changes)) return { ok: true, unchanged: true } as const;
  return repository.updateTask({ ...args, changes });
}