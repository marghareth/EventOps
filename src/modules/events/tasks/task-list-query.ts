// src/modules/events/tasks/task-list-query.ts
// Filtering the task list (B6-F09; D-097). Pure functions: the page filters the tasks it has
// already authorized, so a filter never widens what a role may see or reaches another event's
// tasks. Every value comes from the address (?status=done&priority=high&assignee=unassigned&due=set
// &dueFrom=2026-11-01&dueTo=2026-11-30) and must match a fixed list or be a real date; anything
// else is ignored (no filter). Filters combine with AND. Due dates are days in Philippine time and
// are compared as written ("YYYY-MM-DD" sorts as a date), never as instants.
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type TaskPriority,
  type TaskStatus,
} from "./domain/task";
import { formatCalendarDate, isCalendarDate, isDueDateInRange } from "./domain/due-date";

export type DueFilter = "none" | "set";
export const DUE_FILTERS = ["set", "none"] as const satisfies readonly DueFilter[];
export const DUE_FILTER_LABEL: Record<DueFilter, string> = {
  set: "Has a due date",
  none: "No due date",
};

/** "unassigned", or the ID of a member who is assigned a task in this event. */
export type AssigneeFilter = "unassigned" | string;

export type TaskListQuery = {
  status: TaskStatus | null;
  priority: TaskPriority | null;
  assignee: AssigneeFilter | null;
  due: DueFilter | null;
  /** Due on or after this day ("YYYY-MM-DD"). A task with no due date never matches. */
  dueFrom: string | null;
  /** Due on or before this day ("YYYY-MM-DD"). A task with no due date never matches. */
  dueTo: string | null;
};

/** What the filter reads from a task. */
export type FilterableTask = {
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
};

type Params = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

/** The address value for a status or priority: `?status=in-progress`. */
const param = (value: string) => value.toLowerCase().replaceAll("_", "-");

const day = (value: string): string | null =>
  isCalendarDate(value) && isDueDateInRange(value) ? value : null;

/** The assignees a person can filter by: each member who has a task, once, in list order. */
export function assigneeFilterOptions(
  tasks: readonly FilterableTask[],
): { id: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const task of tasks) if (task.assignee) seen.set(task.assignee.id, task.assignee.name);
  const names = [...seen.values()];
  const used = new Map<string, number>();
  return [...seen.entries()].map(([id, name]) => {
    const duplicate = names.filter((other) => other === name).length > 1;
    const nth = (used.get(name) ?? 0) + 1;
    used.set(name, nth);
    return { id, label: duplicate ? `${name} (${nth})` : name };
  });
}

/**
 * The filters named in the address. An unknown value, a malformed or impossible date, or an
 * assignee who has no task here is ignored rather than refused.
 */
export function parseTaskListQuery(
  params: Params,
  assigneeIds: ReadonlySet<string> = new Set(),
): TaskListQuery {
  const assignee = one(params.assignee);
  return {
    status: TASK_STATUSES.find((value) => param(value) === one(params.status)) ?? null,
    priority: TASK_PRIORITIES.find((value) => param(value) === one(params.priority)) ?? null,
    assignee: assignee === "unassigned" || assigneeIds.has(assignee) ? assignee : null,
    due: DUE_FILTERS.find((value) => value === one(params.due)) ?? null,
    dueFrom: day(one(params.dueFrom)),
    dueTo: day(one(params.dueTo)),
  };
}

/** True when any filter is on. */
export function isNarrowed(query: TaskListQuery): boolean {
  return Object.values(query).some((value) => value !== null);
}

/** The tasks that match every filter that is on, in the same order. */
export function filterTasks<T extends FilterableTask>(
  tasks: readonly T[],
  query: TaskListQuery,
): T[] {
  return tasks.filter((task) => {
    if (query.status && task.status !== query.status) return false;
    if (query.priority && task.priority !== query.priority) return false;
    if (query.assignee === "unassigned" && task.assignee !== null) return false;
    if (query.assignee && query.assignee !== "unassigned" && task.assignee?.id !== query.assignee) {
      return false;
    }
    if (query.due === "set" && task.dueDate === null) return false;
    if (query.due === "none" && task.dueDate !== null) return false;
    if (query.dueFrom && (task.dueDate === null || task.dueDate < query.dueFrom)) return false;
    if (query.dueTo && (task.dueDate === null || task.dueDate > query.dueTo)) return false;
    return true;
  });
}

/** The filters that are on, in words, for "No tasks match". */
export function describeTaskListQuery(
  query: TaskListQuery,
  assigneeLabel: (id: string) => string | undefined = () => undefined,
): string[] {
  const parts: string[] = [];
  if (query.status) parts.push(`Status: ${TASK_STATUS_LABEL[query.status]}`);
  if (query.priority) parts.push(`Priority: ${TASK_PRIORITY_LABEL[query.priority]}`);
  if (query.assignee) {
    parts.push(
      query.assignee === "unassigned"
        ? "Unassigned"
        : `Assigned to ${assigneeLabel(query.assignee) ?? "a member"}`,
    );
  }
  if (query.due) parts.push(DUE_FILTER_LABEL[query.due]);
  if (query.dueFrom) parts.push(`Due on or after ${formatCalendarDate(query.dueFrom)}`);
  if (query.dueTo) parts.push(`Due on or before ${formatCalendarDate(query.dueTo)}`);
  return parts;
}

export { param as taskFilterParam };