// src/modules/events/tasks/domain/task.test.ts
// Task rules without a database (B6-F01 to B6-F05; D-094, D-095): the readable ID, the priorities
// (equal to the database enum and the audit copy) and what an edit changes.
import { describe, expect, it } from "vitest";
import { TaskPriority as DatabaseTaskPriority } from "@/generated/prisma/client";
import { TASK_PRIORITIES as AUDIT_PRIORITIES } from "@/modules/events/audit/public";
import {
  DEFAULT_TASK_PRIORITY,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
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

describe("priorities (B6-F05)", () => {
  it("are High, Medium and Low, most important first, and equal the database enum", () => {
    expect([...TASK_PRIORITIES]).toEqual(["HIGH", "MEDIUM", "LOW"]);
    expect([...TASK_PRIORITIES].sort()).toEqual(Object.values(DatabaseTaskPriority).sort());
  });

  it("equal the audit registry's copy", () => {
    expect([...AUDIT_PRIORITIES]).toEqual([...TASK_PRIORITIES]);
  });

  it("default to Medium, decided by the domain, and every one has a label", () => {
    expect(DEFAULT_TASK_PRIORITY).toBe("MEDIUM");
    expect(TASK_PRIORITIES.map((priority) => TASK_PRIORITY_LABEL[priority])).toEqual([
      "High",
      "Medium",
      "Low",
    ]);
  });
});

describe("diffTask", () => {
  const current: TaskFields = {
    title: "Confirm florist",
    description: "Call Ana",
    priority: "MEDIUM",
    assignee: null,
  };
  const ana = { id: "m1", name: "Ana Reyes" };

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
    expect(diffTask({ ...current, description: null }, { ...current, description: "x" })).toEqual({
      description: { changed: true },
    });
    expect(diffTask({ ...current, description: "x" }, { ...current, description: null })).toEqual({
      description: { changed: true },
    });
  });

  it("records a priority change old → new", () => {
    expect(diffTask(current, { ...current, priority: "HIGH" })).toEqual({
      priority: { from: "MEDIUM", to: "HIGH" },
    });
  });

  it("records assigning, reassigning and unassigning by name", () => {
    const assigned = { ...current, assignee: ana };
    expect(diffTask(current, assigned)).toEqual({ assignee: { from: null, to: "Ana Reyes" } });
    expect(diffTask(assigned, { ...current, assignee: { id: "m2", name: "Ben Cruz" } })).toEqual({
      assignee: { from: "Ana Reyes", to: "Ben Cruz" },
    });
    expect(diffTask(assigned, current)).toEqual({ assignee: { from: "Ana Reyes", to: null } });
  });

  it("treats the same member as unchanged, whatever name is shown for them", () => {
    const assigned = { ...current, assignee: ana };
    expect(diffTask(assigned, { ...assigned, assignee: { id: "m1", name: "Ana R." } })).toEqual({});
  });

  it("lists every field that changed, in order", () => {
    const changes = diffTask(current, {
      title: "New",
      description: null,
      priority: "LOW",
      assignee: ana,
    });
    expect(Object.keys(changes)).toEqual(["title", "description", "priority", "assignee"]);
    expect(hasTaskChanges(changes)).toBe(true);
  });
});