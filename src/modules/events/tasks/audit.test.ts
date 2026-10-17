// src/modules/events/tasks/audit.test.ts
// Task entries in the audit log and the Activity feed (B6-F01, B6-F02; D-094): what each entry may
// hold (the description's text never) and how Activity words it.
import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, describeAuditEntry } from "@/modules/events/audit/public";

const created = AUDIT_ACTIONS["task.created"].details;
const updated = AUDIT_ACTIONS["task.updated"].details;

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