// src/modules/events/tasks/overdue.test.ts
// Overdue task detection (B6-F10; D-098): not Done, has a due date, and the day is before today
// (Philippine time). Today is passed in, so no test reads a clock.
import { describe, expect, it } from "vitest";
import { manilaToday } from "./domain/due-date";
import { isTaskOverdue } from "./overdue";

const TODAY = "2026-10-18";

describe("isTaskOverdue", () => {
  it.each(["NOT_STARTED", "IN_PROGRESS"] as const)(
    "is overdue when %s and due yesterday",
    (status) => {
      expect(isTaskOverdue({ status, dueDate: "2026-10-17" }, TODAY)).toBe(true);
    },
  );

  it("is overdue however long ago it was due, including the first supported day", () => {
    expect(isTaskOverdue({ status: "NOT_STARTED", dueDate: "2026-01-01" }, TODAY)).toBe(true);
    expect(isTaskOverdue({ status: "NOT_STARTED", dueDate: "2000-01-01" }, TODAY)).toBe(true);
  });

  it("is not overdue on the day it is due", () => {
    expect(isTaskOverdue({ status: "NOT_STARTED", dueDate: TODAY }, TODAY)).toBe(false);
    expect(isTaskOverdue({ status: "IN_PROGRESS", dueDate: TODAY }, TODAY)).toBe(false);
  });

  it("is not overdue when due later, including tomorrow", () => {
    expect(isTaskOverdue({ status: "NOT_STARTED", dueDate: "2026-10-19" }, TODAY)).toBe(false);
    expect(isTaskOverdue({ status: "NOT_STARTED", dueDate: "2100-12-31" }, TODAY)).toBe(false);
  });

  it("is never overdue once Done, whether it was finished early or late", () => {
    expect(isTaskOverdue({ status: "DONE", dueDate: "2026-10-17" }, TODAY)).toBe(false);
    expect(isTaskOverdue({ status: "DONE", dueDate: "2000-01-01" }, TODAY)).toBe(false);
  });

  it("is never overdue with no due date", () => {
    expect(isTaskOverdue({ status: "NOT_STARTED", dueDate: null }, TODAY)).toBe(false);
    expect(isTaskOverdue({ status: "IN_PROGRESS", dueDate: null }, TODAY)).toBe(false);
  });

  it("compares days across a month and a year boundary", () => {
    expect(isTaskOverdue({ status: "NOT_STARTED", dueDate: "2026-09-30" }, "2026-10-01")).toBe(
      true,
    );
    expect(isTaskOverdue({ status: "NOT_STARTED", dueDate: "2026-12-31" }, "2027-01-01")).toBe(
      true,
    );
    expect(isTaskOverdue({ status: "NOT_STARTED", dueDate: "2027-01-01" }, "2026-12-31")).toBe(
      false,
    );
  });

  it("refuses a today or a due date that is not a real calendar day", () => {
    expect(() => isTaskOverdue({ status: "NOT_STARTED", dueDate: null }, "2026-02-30")).toThrow();
    expect(() => isTaskOverdue({ status: "NOT_STARTED", dueDate: null }, "today")).toThrow();
    expect(() => isTaskOverdue({ status: "NOT_STARTED", dueDate: "15/11/2026" }, TODAY)).toThrow();
  });
});

describe("manilaToday", () => {
  it("is the Philippine day for an instant, not the UTC day", () => {
    // 15:59 UTC on the 17th is 23:59 in Manila: still the 17th.
    expect(manilaToday(new Date("2026-10-17T15:59:59.999Z"))).toBe("2026-10-17");
    // 16:00 UTC on the 17th is midnight in Manila: already the 18th.
    expect(manilaToday(new Date("2026-10-17T16:00:00.000Z"))).toBe("2026-10-18");
  });

  it("changes a task from due today to overdue at Philippine midnight", () => {
    const task = { status: "NOT_STARTED", dueDate: "2026-10-17" } as const;
    expect(isTaskOverdue(task, manilaToday(new Date("2026-10-17T15:59:59.999Z")))).toBe(false);
    expect(isTaskOverdue(task, manilaToday(new Date("2026-10-17T16:00:00.000Z")))).toBe(true);
  });

  it("handles the end of a year and a leap day", () => {
    expect(manilaToday(new Date("2026-12-31T16:00:00.000Z"))).toBe("2027-01-01");
    expect(manilaToday(new Date("2028-02-28T16:00:00.000Z"))).toBe("2028-02-29");
  });
});