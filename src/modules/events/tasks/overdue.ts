// src/modules/events/tasks/overdue.ts
// Overdue rule for tasks (B6-F10; D-098). Deterministic, never AI. A task is overdue when it is not
// Done, has a due date, and that day is before today. A task due today is not overdue yet; a Done
// task is never overdue, whenever it was due; a task with no due date is never overdue. Dates are
// calendar days in Philippine time (Asia/Manila, UTC+8, no daylight saving; D-025), written
// "YYYY-MM-DD", so comparing two of them as text compares the days. "Today" is passed in: the page
// works it out once per request with manilaToday(new Date()), so this rule never reads a clock and
// tests can fix the day. Pure: no database, no UI. It only identifies; it changes nothing.
import { isCalendarDate } from "./domain/due-date";
import type { TaskStatus } from "./domain/task";

/** What the rule reads from one task. */
export type TaskForOverdue = { status: TaskStatus; dueDate: string | null };

/** True when the task is not Done and its due day has passed (before `today`). */
export function isTaskOverdue(task: TaskForOverdue, today: string): boolean {
  if (!isCalendarDate(today)) throw new Error("Today must be a calendar date (YYYY-MM-DD).");
  if (task.dueDate === null || task.status === "DONE") return false;
  if (!isCalendarDate(task.dueDate)) throw new Error("A due date must be a calendar date.");
  return task.dueDate < today;
}