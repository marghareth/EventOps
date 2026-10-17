// src/modules/events/tasks/schema.test.ts
// The task form schema (B6-F01, B6-F02; D-094): what the server accepts and the message for each
// refusal, at the length boundaries.
import { describe, expect, it } from "vitest";
import { TASK_DESCRIPTION_MAX, TASK_TITLE_MAX } from "./domain/task";
import { taskFormSchema } from "./schema";

const parse = (title: string, description = "") => taskFormSchema.safeParse({ title, description });
const messages = (result: ReturnType<typeof parse>) =>
  result.success ? [] : result.error.issues.map((issue) => issue.message);

describe("taskFormSchema", () => {
  it("accepts a title alone and stores a blank description as null", () => {
    const result = parse("Confirm florist");
    expect(result.success && result.data).toEqual({ title: "Confirm florist", description: null });
  });

  it("trims both fields", () => {
    const result = parse("  Confirm florist  ", "  Call Ana.  ");
    expect(result.success && result.data).toEqual({
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
      eventId: "other",
      number: "99",
      role: "OWNER",
    });
    expect(result.success && Object.keys(result.data)).toEqual(["title", "description"]);
  });
});