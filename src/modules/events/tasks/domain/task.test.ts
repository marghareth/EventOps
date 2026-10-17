// src/modules/events/tasks/domain/task.test.ts
// Task rules without a database (B6-F01, B6-F02; D-094): the readable ID and what an edit changes.
import { describe, expect, it } from "vitest";
import { diffTask, formatTaskReference, hasTaskChanges, isTaskReference } from "./task";

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

describe("diffTask", () => {
  const current = { title: "Confirm florist", description: "Call Ana" };

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
    expect(diffTask({ title: "A", description: null }, { title: "A", description: "x" })).toEqual({
      description: { changed: true },
    });
    expect(diffTask({ title: "A", description: "x" }, { title: "A", description: null })).toEqual({
      description: { changed: true },
    });
  });

  it("lists both fields when both changed", () => {
    const changes = diffTask(current, { title: "New", description: null });
    expect(Object.keys(changes)).toEqual(["title", "description"]);
    expect(hasTaskChanges(changes)).toBe(true);
  });
});