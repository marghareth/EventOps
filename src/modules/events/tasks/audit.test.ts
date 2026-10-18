// src/modules/events/tasks/audit.test.ts
// Task entries in the audit log and the Activity feed (B6-F01 to B6-F07; D-094 to D-096): what each entry may
// hold (the description's text never) and how Activity words it.
import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, describeAuditEntry } from "@/modules/events/audit/public";

const created = AUDIT_ACTIONS["task.created"].details;
const updated = AUDIT_ACTIONS["task.updated"].details;
const deleted = AUDIT_ACTIONS["task.deleted"].details;

describe("what a task entry may hold", () => {
  it("accepts a created task with its readable ID and title, and nothing else", () => {
    expect(created.safeParse({ reference: "TSK-0001", title: "Confirm florist" }).success).toBe(
      true,
    );
    expect(
      created.safeParse({ reference: "TSK-0001", title: "A", description: "secret" }).success,
    ).toBe(false);
  });

  it("needs a well-formed readable ID", () => {
    expect(created.safeParse({ reference: "task-1", title: "A" }).success).toBe(false);
    expect(created.safeParse({ reference: "BUD-0001", title: "A" }).success).toBe(false);
  });

  it("records a title change old → new and a description change only as changed", () => {
    const entry = (changes: unknown) =>
      updated.safeParse({ reference: "TSK-0001", title: "New", changes }).success;
    expect(entry({ title: { from: "Old", to: "New" } })).toBe(true);
    expect(entry({ description: { changed: true } })).toBe(true);
    expect(entry({ description: { from: "Call Ana at 0917 555 0101", to: "x" } })).toBe(false);
    expect(entry({ description: { from: null, to: null } })).toBe(false);
  });

  it("refuses an edit entry that changes nothing", () => {
    expect(updated.safeParse({ reference: "TSK-0001", title: "A", changes: {} }).success).toBe(
      false,
    );
  });
});

describe("how Activity words task entries", () => {
  it("describes an added task by title and readable ID", () => {
    expect(
      describeAuditEntry({
        action: "task.created",
        details: { reference: "TSK-0004", title: "Confirm florist" },
      }),
    ).toEqual({ summary: "Added the task Confirm florist (TSK-0004)", lines: [] });
  });

  it("describes an edit with the title change, then the description as changed", () => {
    expect(
      describeAuditEntry({
        action: "task.updated",
        details: {
          reference: "TSK-0004",
          title: "Confirm both florists",
          changes: {
            description: { changed: true },
            title: { from: "Confirm florist", to: "Confirm both florists" },
          },
        },
      }),
    ).toEqual({
      summary: "Edited the task Confirm both florists (TSK-0004)",
      lines: ["Title: “Confirm florist” → “Confirm both florists”", "Description changed"],
    });
  });

  it("describes a description-only edit with one line", () => {
    expect(
      describeAuditEntry({
        action: "task.updated",
        details: {
          reference: "TSK-0004",
          title: "Confirm florist",
          changes: { description: { changed: true } },
        },
      }).lines,
    ).toEqual(["Description changed"]);
  });
});

describe("priority and assignee in task entries (B6-F04, B6-F05)", () => {
  const entry = (changes: unknown) =>
    updated.safeParse({ reference: "TSK-0001", title: "A", changes }).success;

  it("accepts the priority and the assignee as old → new, and nothing looser", () => {
    expect(entry({ priority: { from: "MEDIUM", to: "HIGH" } })).toBe(true);
    expect(entry({ priority: { from: "MEDIUM", to: "URGENT" } })).toBe(false);
    expect(entry({ assignee: { from: null, to: "Ana Reyes" } })).toBe(true);
    expect(entry({ assignee: { from: "Ana Reyes", to: null } })).toBe(true);
    expect(entry({ assignee: { changed: true } })).toBe(false);
  });

  it("keeps entries written before priority and assignee existed valid", () => {
    expect(created.safeParse({ reference: "TSK-0001", title: "Confirm florist" }).success).toBe(
      true,
    );
  });

  it("records a new task's priority and assignee, and nothing else", () => {
    const base = { reference: "TSK-0001", title: "A" };
    expect(created.safeParse({ ...base, priority: "HIGH", assignee: "Ana Reyes" }).success).toBe(
      true,
    );
    expect(created.safeParse({ ...base, priority: "HIGH", assignee: null }).success).toBe(true);
    expect(created.safeParse({ ...base, priority: "SOON" }).success).toBe(false);
    expect(created.safeParse({ ...base, assigneeId: "m1" }).success).toBe(false);
  });

  it("describes a new task's priority and assignee on their own lines", () => {
    expect(
      describeAuditEntry({
        action: "task.created",
        details: {
          reference: "TSK-0004",
          title: "Confirm florist",
          priority: "HIGH",
          assignee: "Ana Reyes",
        },
      }),
    ).toEqual({
      summary: "Added the task Confirm florist (TSK-0004)",
      lines: ["Priority: High", "Assigned to Ana Reyes"],
    });
  });

  it("describes an old-style created entry with no extra lines", () => {
    expect(
      describeAuditEntry({
        action: "task.created",
        details: { reference: "TSK-0004", title: "Confirm florist" },
      }).lines,
    ).toEqual([]);
  });

  it("describes a priority change and an assignment in words", () => {
    expect(
      describeAuditEntry({
        action: "task.updated",
        details: {
          reference: "TSK-0004",
          title: "Confirm florist",
          changes: {
            priority: { from: "MEDIUM", to: "HIGH" },
            assignee: { from: null, to: "Ana Reyes" },
          },
        },
      }).lines,
    ).toEqual(["Priority: Medium → High", "Assignee: Unassigned → Ana Reyes"]);
  });

  it("describes an unassignment", () => {
    expect(
      describeAuditEntry({
        action: "task.updated",
        details: {
          reference: "TSK-0004",
          title: "Confirm florist",
          changes: { assignee: { from: "Ana Reyes", to: null } },
        },
      }).lines,
    ).toEqual(["Assignee: Ana Reyes → Unassigned"]);
  });
});

describe("status and due date in task entries (B6-F06, B6-F07)", () => {
  const entry = (changes: unknown) =>
    updated.safeParse({ reference: "TSK-0001", title: "A", changes }).success;

  it("accepts a status and a due date as old → new, and nothing looser", () => {
    expect(entry({ status: { from: "NOT_STARTED", to: "DONE" } })).toBe(true);
    expect(entry({ status: { from: "NOT_STARTED", to: "BLOCKED" } })).toBe(false);
    expect(entry({ dueDate: { from: null, to: "2026-11-15" } })).toBe(true);
    expect(entry({ dueDate: { from: "2026-11-15", to: null } })).toBe(true);
    expect(entry({ dueDate: { from: null, to: "15 November" } })).toBe(false);
    expect(entry({ dueDate: { changed: true } })).toBe(false);
  });

  it("records a new task's status and due date, and keeps older entries valid", () => {
    const base = { reference: "TSK-0001", title: "A" };
    expect(created.safeParse(base).success).toBe(true);
    expect(
      created.safeParse({ ...base, status: "IN_PROGRESS", dueDate: "2026-11-15" }).success,
    ).toBe(true);
    expect(created.safeParse({ ...base, status: "DONE", dueDate: null }).success).toBe(true);
    expect(created.safeParse({ ...base, status: "LATE" }).success).toBe(false);
  });

  it("describes a new task's status and due date on their own lines", () => {
    expect(
      describeAuditEntry({
        action: "task.created",
        details: {
          reference: "TSK-0004",
          title: "Confirm florist",
          status: "IN_PROGRESS",
          dueDate: "2026-11-15",
        },
      }).lines,
    ).toEqual(["Status: In progress", "Due Nov 15, 2026"]);
  });

  it("describes a status change and a due date being set, moved and cleared", () => {
    const lines = (changes: unknown) =>
      describeAuditEntry({
        action: "task.updated",
        details: { reference: "TSK-0004", title: "Confirm florist", changes },
      }).lines;
    expect(lines({ status: { from: "NOT_STARTED", to: "DONE" } })).toEqual([
      "Status: Not started → Done",
    ]);
    expect(lines({ dueDate: { from: null, to: "2026-11-15" } })).toEqual([
      "Due date: none → Nov 15, 2026",
    ]);
    expect(lines({ dueDate: { from: "2026-11-15", to: "2026-11-20" } })).toEqual([
      "Due date: Nov 15, 2026 → Nov 20, 2026",
    ]);
    expect(lines({ dueDate: { from: "2026-11-20", to: null } })).toEqual([
      "Due date: Nov 20, 2026 → none",
    ]);
  });
});

describe("a deleted task entry (B6-F03)", () => {
  it("keeps the readable ID and the title, and nothing else", () => {
    expect(deleted.safeParse({ reference: "TSK-0001", title: "Confirm florist" }).success).toBe(
      true,
    );
    expect(
      deleted.safeParse({ reference: "TSK-0001", title: "A", description: "secret" }).success,
    ).toBe(false);
    expect(deleted.safeParse({ reference: "task-1", title: "A" }).success).toBe(false);
  });

  it("is worded as a removal, by title and readable ID", () => {
    expect(
      describeAuditEntry({
        action: "task.deleted",
        details: { reference: "TSK-0004", title: "Confirm florist" },
      }),
    ).toEqual({ summary: "Removed the task Confirm florist (TSK-0004)", lines: [] });
  });
});