// src/modules/events/tasks/schema.test.ts
// The task form schema (B6-F01 to B6-F07; D-094 to D-096): what the server accepts and the message
// for each refusal, at the length boundaries.
import { describe, expect, it } from "vitest";
import {
  TASK_DESCRIPTION_MAX,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TITLE_MAX,
} from "./domain/task";
import { taskFormSchema } from "./schema";

const MEMBER = "a0000000-0000-4000-8000-00000000000a";

const parse = (
  title: string,
  description = "",
  extra: { priority?: string; status?: string; dueDate?: string; assigneeId?: string } = {},
) =>
  taskFormSchema.safeParse({
    title,
    description,
    priority: "MEDIUM",
    status: "NOT_STARTED",
    dueDate: "",
    assigneeId: "",
    ...extra,
  });
const messages = (result: ReturnType<typeof parse>) =>
  result.success ? [] : result.error.issues.map((issue) => issue.message);

describe("taskFormSchema", () => {
  it("accepts a title alone and stores a blank description and no assignee as null", () => {
    const result = parse("Confirm florist");
    expect(result.success && result.data).toEqual({
      title: "Confirm florist",
      description: null,
      priority: "MEDIUM",
      status: "NOT_STARTED",
      dueDate: null,
      assigneeId: null,
    });
  });

  it("trims both text fields", () => {
    const result = parse("  Confirm florist  ", "  Call Ana.  ");
    expect(result.success && result.data).toMatchObject({
      title: "Confirm florist",
      description: "Call Ana.",
    });
  });

  it("treats a whitespace-only description as none", () => {
    const result = parse("A", "   \n  ");
    expect(result.success && result.data.description).toBeNull();
  });

  it("refuses a missing or blank title with a message", () => {
    expect(messages(parse(""))).toEqual(["Enter a task title."]);
    expect(messages(parse("    "))).toEqual(["Enter a task title."]);
  });

  it("accepts a title of exactly the maximum and refuses one more", () => {
    expect(parse("x".repeat(TASK_TITLE_MAX)).success).toBe(true);
    expect(messages(parse("x".repeat(TASK_TITLE_MAX + 1)))).toEqual([
      `Keep the title to ${TASK_TITLE_MAX} characters or fewer.`,
    ]);
  });

  it("accepts a description of exactly the maximum and refuses one more", () => {
    expect(parse("A", "x".repeat(TASK_DESCRIPTION_MAX)).success).toBe(true);
    expect(messages(parse("A", "x".repeat(TASK_DESCRIPTION_MAX + 1)))).toEqual([
      `Keep the description to ${TASK_DESCRIPTION_MAX} characters or fewer.`,
    ]);
  });

  it("keeps line breaks inside a description", () => {
    const result = parse("A", "line one\nline two");
    expect(result.success && result.data.description).toBe("line one\nline two");
  });

  it("ignores fields outside the form", () => {
    const result = taskFormSchema.safeParse({
      title: "A",
      description: "",
      priority: "HIGH",
      status: "DONE",
      dueDate: "",
      assigneeId: "",
      eventId: "other",
      number: "99",
      role: "OWNER",
    });
    expect(result.success && Object.keys(result.data)).toEqual([
      "title",
      "description",
      "priority",
      "status",
      "dueDate",
      "assigneeId",
    ]);
  });
});

describe("priority (B6-F05)", () => {
  it.each(TASK_PRIORITIES)("accepts %s", (priority) => {
    const result = parse("A", "", { priority });
    expect(result.success && result.data.priority).toBe(priority);
  });

  it.each(["", "URGENT", "high", "Medium", " HIGH", "0"])("refuses %j with a message", (value) => {
    expect(messages(parse("A", "", { priority: value }))).toEqual(["Choose a priority."]);
  });

  it("refuses a missing priority", () => {
    const result = taskFormSchema.safeParse({
      title: "A",
      description: "",
      status: "NOT_STARTED",
      dueDate: "",
      assigneeId: "",
    });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues.map((issue) => issue.message)).toEqual([
      "Choose a priority.",
    ]);
  });
});

describe("assignee (B6-F04)", () => {
  it("accepts a member ID", () => {
    const result = parse("A", "", { assigneeId: MEMBER });
    expect(result.success && result.data.assigneeId).toBe(MEMBER);
  });

  it("reads a blank choice, even with spaces, as unassigned", () => {
    for (const blank of ["", "   "]) {
      const result = parse("A", "", { assigneeId: blank });
      expect(result.success && result.data.assigneeId).toBeNull();
    }
  });

  it.each(["not-a-uuid", "1", "ana", "a0000000-0000-4000-8000-00000000000"])(
    "refuses %j, which is not a member ID",
    (value) => {
      expect(messages(parse("A", "", { assigneeId: value }))).toEqual([
        "Choose a member of this event.",
      ]);
    },
  );
});

it("lists every field the form posts", async () => {
  const { TASK_FIELDS } = await import("./schema");
  expect([...TASK_FIELDS]).toEqual([
    "title",
    "description",
    "priority",
    "status",
    "dueDate",
    "assigneeId",
  ]);
});

describe("status (B6-F06)", () => {
  it.each(TASK_STATUSES)("accepts %s", (status) => {
    const result = parse("A", "", { status });
    expect(result.success && result.data.status).toBe(status);
  });

  it.each(["", "done", "BLOCKED", "CANCELLED"])("refuses %j", (value) => {
    expect(messages(parse("A", "", { status: value }))).toEqual(["Choose a status."]);
  });
});

describe("due date (B6-F07)", () => {
  it("stores a blank date as null", () => {
    const result = parse("A", "", { dueDate: "   " });
    expect(result.success && result.data.dueDate).toBeNull();
  });

  it.each(["2026-11-15", "2000-01-01", "2100-12-31", "2028-02-29"])("accepts %s", (dueDate) => {
    const result = parse("A", "", { dueDate });
    expect(result.success && result.data.dueDate).toBe(dueDate);
  });

  it("accepts a date that has already passed", () => {
    expect(parse("A", "", { dueDate: "2026-01-01" }).success).toBe(true);
  });

  it.each(["2026-02-30", "2027-02-29", "2026-13-01", "15/11/2026", "tomorrow", "2026-11-15T10:00"])(
    "refuses %j as not a real date",
    (dueDate) => {
      expect(messages(parse("A", "", { dueDate }))).toEqual([
        "Enter a real date, for example 2026-11-15.",
      ]);
    },
  );

  it.each(["1999-12-31", "2101-01-01"])("refuses %s as out of range", (dueDate) => {
    expect(messages(parse("A", "", { dueDate }))).toEqual([
      "Enter a date from Jan 1, 2000 to Dec 31, 2100.",
    ]);
  });
});