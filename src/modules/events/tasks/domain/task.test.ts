// src/modules/events/tasks/domain/task.test.ts
// Task rules without a database (B6-F01 to B6-F07; D-094 to D-096): the readable ID, the priorities, the statuses
// and what an edit changes.
import { describe, expect, it } from "vitest";
import {
  TaskPriority as DatabaseTaskPriority,
  TaskStatus as DatabaseTaskStatus,
} from "@/generated/prisma/client";
import {
  TASK_PRIORITIES as AUDIT_TASK_PRIORITIES,
  TASK_PRIORITY_LABEL as AUDIT_LABEL,
  TASK_STATUSES as AUDIT_TASK_STATUSES,
  TASK_STATUS_LABEL as AUDIT_STATUS_LABEL,
} from "@/modules/events/audit/public";
import {
  DEFAULT_TASK_PRIORITY,
  DEFAULT_TASK_STATUS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  diffTask,
  formatTaskReference,
  hasTaskChanges,
  isTaskReference,
  type TaskFields,
} from "./task";

describe("formatTaskReference", () => {
  it("pads to four digits and keeps growing past 9999", () => {
    expect(formatTaskReference(1)).toBe("TSK-0001");
    expect(formatTaskReference(42)).toBe("TSK-0042");
    expect(formatTaskReference(12345)).toBe("TSK-12345");
  });
});

describe("isTaskReference", () => {
  it("accepts only a well-formed readable ID", () => {
    expect(isTaskReference("TSK-0001")).toBe(true);
    expect(isTaskReference("TSK-12345")).toBe(true);
    for (const bad of [undefined, "", "TSK-1", "tsk-0001", "BUD-0001", "TSK-0001 ", "TSK-00a1"]) {
      expect(isTaskReference(bad)).toBe(false);
    }
  });
});

describe("task priorities (D-095)", () => {
  it("lists High, Medium and Low, most important first", () => {
    expect([...TASK_PRIORITIES]).toEqual(["HIGH", "MEDIUM", "LOW"]);
  });

  it("gives a new task Medium priority unless another is chosen", () => {
    expect(DEFAULT_TASK_PRIORITY).toBe("MEDIUM");
  });

  it("has a label for every priority and no other", () => {
    expect(Object.keys(TASK_PRIORITY_LABEL).sort()).toEqual([...TASK_PRIORITIES].sort());
    expect(TASK_PRIORITY_LABEL).toEqual({ HIGH: "High", MEDIUM: "Medium", LOW: "Low" });
  });

  it("stays equal to the database enum and to the audit registry's copy", () => {
    expect([...TASK_PRIORITIES].sort()).toEqual(Object.values(DatabaseTaskPriority).sort());
    expect([...AUDIT_TASK_PRIORITIES]).toEqual([...TASK_PRIORITIES]);
    expect(AUDIT_LABEL).toEqual(TASK_PRIORITY_LABEL);
  });
});

describe("task status (B6-F06)", () => {
  it("lists Not started, In progress and Done, in that order, starting at Not started", () => {
    expect([...TASK_STATUSES]).toEqual(["NOT_STARTED", "IN_PROGRESS", "DONE"]);
    expect(DEFAULT_TASK_STATUS).toBe("NOT_STARTED");
    expect(TASK_STATUS_LABEL).toEqual({
      NOT_STARTED: "Not started",
      IN_PROGRESS: "In progress",
      DONE: "Done",
    });
  });

  it("stays equal to the database enum and to the audit registry's copy", () => {
    expect([...TASK_STATUSES].sort()).toEqual(Object.values(DatabaseTaskStatus).sort());
    expect([...AUDIT_TASK_STATUSES]).toEqual([...TASK_STATUSES]);
    expect(AUDIT_STATUS_LABEL).toEqual(TASK_STATUS_LABEL);
  });
});

describe("diffTask", () => {
  const ana = { id: "m-ana", name: "Ana Reyes" };
  const ben = { id: "m-ben", name: "Ben Cruz" };
  const current: TaskFields = {
    title: "Confirm florist",
    description: "Call Ana",
    priority: "MEDIUM",
    status: "NOT_STARTED",
    dueDate: null,
    assignee: null,
  };

  it("is empty when nothing changed", () => {
    expect(diffTask(current, { ...current })).toEqual({});
    expect(hasTaskChanges(diffTask(current, { ...current }))).toBe(false);
  });

  it("records a title change old → new", () => {
    expect(diffTask(current, { ...current, title: "Confirm florists" })).toEqual({
      title: { from: "Confirm florist", to: "Confirm florists" },
    });
  });

  it("records a description change only as changed, never its text", () => {
    const changes = diffTask(current, { ...current, description: "Call Ana at 0917 555 0101" });
    expect(changes).toEqual({ description: { changed: true } });
    expect(JSON.stringify(changes)).not.toContain("0917");
  });

  it("sees adding and clearing a description as a change", () => {
    expect(diffTask(current, { ...current, description: null })).toEqual({
      description: { changed: true },
    });
    expect(diffTask({ ...current, description: null }, current)).toEqual({
      description: { changed: true },
    });
  });

  it("records a status change old → new (B6-F06)", () => {
    expect(diffTask(current, { ...current, status: "IN_PROGRESS" })).toEqual({
      status: { from: "NOT_STARTED", to: "IN_PROGRESS" },
    });
  });

  it("records a due date being set, moved and cleared (B6-F07)", () => {
    const set = { ...current, dueDate: "2026-11-15" };
    expect(diffTask(current, set)).toEqual({ dueDate: { from: null, to: "2026-11-15" } });
    expect(diffTask(set, { ...set, dueDate: "2026-11-20" })).toEqual({
      dueDate: { from: "2026-11-15", to: "2026-11-20" },
    });
    expect(diffTask(set, current)).toEqual({ dueDate: { from: "2026-11-15", to: null } });
    expect(diffTask(set, { ...set })).toEqual({});
  });

  it("records a priority change old → new", () => {
    expect(diffTask(current, { ...current, priority: "HIGH" })).toEqual({
      priority: { from: "MEDIUM", to: "HIGH" },
    });
  });

  it("records assigning, reassigning and unassigning by name", () => {
    expect(diffTask(current, { ...current, assignee: ana })).toEqual({
      assignee: { from: null, to: "Ana Reyes" },
    });
    expect(diffTask({ ...current, assignee: ana }, { ...current, assignee: ben })).toEqual({
      assignee: { from: "Ana Reyes", to: "Ben Cruz" },
    });
    expect(diffTask({ ...current, assignee: ana }, current)).toEqual({
      assignee: { from: "Ana Reyes", to: null },
    });
  });

  it("treats the same member as unchanged even if the name shown differs", () => {
    const renamed = { id: ana.id, name: "Ana R." };
    expect(diffTask({ ...current, assignee: ana }, { ...current, assignee: renamed })).toEqual({});
  });

  it("lists every field that changed, in a stable order", () => {
    const changes = diffTask(current, {
      title: "New",
      description: null,
      priority: "LOW",
      status: "DONE",
      dueDate: "2026-11-15",
      assignee: ana,
    });
    expect(Object.keys(changes)).toEqual([
      "title",
      "description",
      "priority",
      "status",
      "dueDate",
      "assignee",
    ]);
    expect(hasTaskChanges(changes)).toBe(true);
  });
});