// src/modules/events/tasks/domain/task.ts
// Task rules that need no database (B6-F01 to B6-F07; D-094, D-095, D-096): the readable ID, the
// field limits, the priorities and statuses, and the list of fields an edit can change. Whether a
// task is overdue is not decided here: that is its own feature.
import type { TaskChanges } from "@/modules/events/audit/public";

export const TASK_TITLE_MAX = 120;
export const TASK_DESCRIPTION_MAX = 2000;

/**
 * How important a task is, most important first (D-095). A test keeps this list equal to the
 * database enum and to the audit registry's copy.
 */
export const TASK_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** What a new task gets when nothing else is chosen (D-095). The domain decides, not the column. */
export const DEFAULT_TASK_PRIORITY: TaskPriority = "MEDIUM";

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

/**
 * How far a task has got, in the order work normally moves (D-096). Any value can follow any other,
 * so a finished task can be reopened. A test keeps this list equal to the database enum and to the
 * audit registry's copy.
 */
export const TASK_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** What a new task gets when nothing else is chosen (D-096). The domain decides, not the column. */
export const DEFAULT_TASK_STATUS: TaskStatus = "NOT_STARTED";

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

const REFERENCE_PATTERN = /^TSK-\d{4,}$/;

/** 4 → "TSK-0004". Numbers are issued per event and never reused (D-094). */
export function formatTaskReference(number: number): string {
  return `TSK-${String(number).padStart(4, "0")}`;
}

/** True for a well-formed readable ID such as "TSK-0004". Used to trust a ?ref= value in the URL. */
export function isTaskReference(value: string | undefined): value is string {
  return typeof value === "string" && REFERENCE_PATTERN.test(value);
}

/** The assignee as the domain sees it: the member's ID and the name shown for them. */
export type TaskAssignee = { id: string; name: string };

/** The editable fields of a task, as stored. */
export type TaskFields = {
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  /** The day it is due, "YYYY-MM-DD", or null for no deadline (D-096). */
  dueDate: string | null;
  assignee: TaskAssignee | null;
};

/**
 * What an edit really changes, in the shape the audit log stores (D-037): the title, the priority,
 * the status and the due date old → new, the assignee old → new by name ("none" is null), and the description only
 * as "changed", never its text (D-094). Empty when nothing changed, so a save that changes nothing
 * writes nothing. Pure: compares exact values only. Two assignees are the same when their member
 * IDs are the same, whatever their names.
 */
export function diffTask(current: TaskFields, next: TaskFields): TaskChanges {
  const changes: TaskChanges = {};
  if (current.title !== next.title) changes.title = { from: current.title, to: next.title };
  if (current.description !== next.description) changes.description = { changed: true };
  if (current.priority !== next.priority) {
    changes.priority = { from: current.priority, to: next.priority };
  }
  if (current.status !== next.status) {
    changes.status = { from: current.status, to: next.status };
  }
  if (current.dueDate !== next.dueDate) {
    changes.dueDate = { from: current.dueDate, to: next.dueDate };
  }
  if ((current.assignee?.id ?? null) !== (next.assignee?.id ?? null)) {
    changes.assignee = { from: current.assignee?.name ?? null, to: next.assignee?.name ?? null };
  }
  return changes;
}

export const hasTaskChanges = (changes: TaskChanges) => Object.keys(changes).length > 0;