// src/modules/events/tasks/domain/task.ts
// Task rules that need no database (B6-F01, B6-F02; D-094): the readable ID, the field limits and
// the list of fields an edit can change. Nothing about assignees, due dates, priority or status
// lives here: those are later features.
import type { TaskChanges } from "@/modules/events/audit/public";

export const TASK_TITLE_MAX = 120;
export const TASK_DESCRIPTION_MAX = 2000;

const REFERENCE_PATTERN = /^TSK-\d{4,}$/;

/** 4 → "TSK-0004". Numbers are issued per event and never reused (D-094). */
export function formatTaskReference(number: number): string {
  return `TSK-${String(number).padStart(4, "0")}`;
}

/** True for a well-formed readable ID such as "TSK-0004". Used to trust a ?ref= value in the URL. */
export function isTaskReference(value: string | undefined): value is string {
  return typeof value === "string" && REFERENCE_PATTERN.test(value);
}

/**
 * What an edit really changes, in the shape the audit log stores (D-037): the title old → new, and
 * the description only as "changed", never its text (D-094). Empty when nothing changed, so a save
 * that changes nothing writes nothing. Pure: compares exact strings only.
 */
export function diffTask(
  current: { title: string; description: string | null },
  next: { title: string; description: string | null },
): TaskChanges {
  const changes: TaskChanges = {};
  if (current.title !== next.title) changes.title = { from: current.title, to: next.title };
  if (current.description !== next.description) changes.description = { changed: true };
  return changes;
}

export const hasTaskChanges = (changes: TaskChanges) => Object.keys(changes).length > 0;