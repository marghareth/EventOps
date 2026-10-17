// src/modules/events/tasks/ui/TaskNotice.test.tsx
// The confirmation after a task change (B6-F01 to B6-F03): a polite status message in words.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskNotice } from "./TaskNotice";

describe("TaskNotice", () => {
  it("says a task was added, with its ID and title", () => {
    render(<TaskNotice kind="task-added" reference="TSK-0004" title="Confirm florist" />);
    expect(screen.getByRole("status")).toHaveTextContent("Task TSK-0004 “Confirm florist” added.");
  });

  it("says a task was saved, and copes with a title that is no longer there", () => {
    render(<TaskNotice kind="task-saved" reference="TSK-0004" />);
    expect(screen.getByRole("status")).toHaveTextContent("Task TSK-0004 saved.");
  });

  it("says a task was removed, by its ID only, since the record is gone", () => {
    render(<TaskNotice kind="task-removed" reference="TSK-0004" />);
    expect(screen.getByRole("status")).toHaveTextContent("Task TSK-0004 removed.");
  });
});