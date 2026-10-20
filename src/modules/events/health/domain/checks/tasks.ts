// src/modules/events/health/domain/checks/tasks.ts
// Task health (B8-F06; D-105, checks T1 and T2). Pure. "Overdue" is the tasks' own rule (D-098):
// not Done, due before today in Philippine time.
//   T1 no overdue tasks                      any High-priority overdue → Critical; others → Needs attention
//   T2 no open High-priority task unassigned any → Needs attention
// Both are Not checked while the event has no tasks.
import type { HealthCheckResult } from "../health-check";
import { count } from "../health-check";
import type { HealthState, HealthTask } from "../health-state";

const fix = { target: "tasks", label: "Open Tasks" } as const;

const named = (tasks: readonly HealthTask[]) =>
  tasks
    .slice(0, 5)
    .map((t) => `${t.reference} “${t.title}”`)
    .join("; ") + (tasks.length > 5 ? `; and ${tasks.length - 5} more` : "");

export function taskChecks(state: HealthState): HealthCheckResult[] {
  const tasks = state.tasks;
  const base = (id: string, label: string) => ({ id, area: "TASKS" as const, label });
  if (tasks.length === 0) {
    const reason = "The event has no tasks yet, so this can't be checked.";
    const add = { target: "tasks", label: "Add a task" } as const;
    return [
      {
        ...base("tasks.overdue", "No task is overdue"),
        outcome: "NOT_CHECKED",
        summary: "No tasks yet",
        reason,
        references: [],
        fix: add,
      },
      {
        ...base("tasks.unassigned", "Every open High-priority task has someone assigned"),
        outcome: "NOT_CHECKED",
        summary: "No tasks yet",
        reason,
        references: [],
        fix: add,
      },
    ];
  }

  const overdue = tasks.filter((t) => t.overdue);
  const high = overdue.filter((t) => t.priority === "HIGH");
  const unassigned = tasks.filter((t) => !t.done && t.priority === "HIGH" && !t.assigned);

  return [
    overdue.length > 0
      ? {
          ...base("tasks.overdue", "No task is overdue"),
          outcome: high.length > 0 ? "CRITICAL" : "NEEDS_ATTENTION",
          summary: `${count(overdue.length, "task is", "tasks are")} overdue${high.length > 0 ? `, ${high.length} High priority` : ""}`,
          reason: `Not Done and past the due date (Philippine time): ${named(overdue)}.${high.length > 0 ? " An overdue High-priority task makes this Critical." : ""}`,
          references: overdue.map((t) => t.reference),
          fix,
        }
      : {
          ...base("tasks.overdue", "No task is overdue"),
          outcome: "PASSED",
          summary: "No overdue tasks",
          reason: "No task that is not Done is past its due date.",
          references: [],
          fix: null,
        },
    unassigned.length > 0
      ? {
          ...base("tasks.unassigned", "Every open High-priority task has someone assigned"),
          outcome: "NEEDS_ATTENTION",
          summary: `${count(unassigned.length, "High-priority task has", "High-priority tasks have")} no one assigned`,
          reason: `Not Done, High priority and unassigned: ${named(unassigned)}.`,
          references: unassigned.map((t) => t.reference),
          fix,
        }
      : {
          ...base("tasks.unassigned", "Every open High-priority task has someone assigned"),
          outcome: "PASSED",
          summary: "High-priority tasks are assigned",
          reason: "Every High-priority task that is not Done has someone assigned.",
          references: [],
          fix: null,
        },
  ];
}