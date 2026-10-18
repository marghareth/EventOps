// src/modules/events/tasks/ui/TaskListControls.test.tsx
// The task filters (B6-F09; D-097): labelled fields, values kept from the address, a plain GET
// form, and "Clear filters" only while narrowed.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { parseTaskListQuery } from "../task-list-query";
import { TaskListControls } from "./TaskListControls";

const ANA = "b0000000-0000-4000-8000-00000000000a";
const assignees = [{ id: ANA, label: "Ana Reyes" }];
const href = "/events/e1/tasks";

const show = (params: Record<string, string> = {}, narrowed = false) =>
  render(
    <TaskListControls
      query={parseTaskListQuery(params, new Set([ANA]))}
      assignees={assignees}
      listHref={href}
      narrowed={narrowed}
    />,
  );

describe("TaskListControls", () => {
  it("is a plain GET form to the task list, so filters live in the address", () => {
    show();
    const form = screen.getByRole("search", { name: "Filter tasks" });
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", href);
    expect(screen.getByRole("button", { name: "Apply" })).toBeVisible();
  });

  it("labels every field and starts with no filter", () => {
    show();
    expect(screen.getByLabelText("Status")).toHaveValue("");
    expect(screen.getByLabelText("Priority")).toHaveValue("");
    expect(screen.getByLabelText("Assigned to")).toHaveValue("");
    expect(screen.getByLabelText("Due date")).toHaveValue("");
    expect(screen.getByLabelText("Due on or after")).toHaveValue("");
    expect(screen.getByLabelText("Due on or before")).toHaveValue("");
  });

  it("offers the status, priority, assignee and due choices", () => {
    show();
    const text = (label: string) =>
      within(screen.getByLabelText(label))
        .getAllByRole("option")
        .map((option) => option.textContent);
    expect(text("Status")).toEqual(["Any status", "Not started", "In progress", "Done"]);
    expect(text("Priority")).toEqual(["Any priority", "High", "Medium", "Low"]);
    expect(text("Assigned to")).toEqual(["Anyone", "Unassigned", "Ana Reyes"]);
    expect(text("Due date")).toEqual(["Any due date", "Has a due date", "No due date"]);
  });

  it("keeps what the address asked for", () => {
    show(
      {
        status: "in-progress",
        priority: "high",
        assignee: ANA,
        due: "set",
        dueFrom: "2026-11-01",
        dueTo: "2026-11-30",
      },
      true,
    );
    expect(screen.getByLabelText("Status")).toHaveValue("in-progress");
    expect(screen.getByLabelText("Priority")).toHaveValue("high");
    expect(screen.getByLabelText("Assigned to")).toHaveValue(ANA);
    expect(screen.getByLabelText("Due date")).toHaveValue("set");
    expect(screen.getByLabelText("Due on or after")).toHaveValue("2026-11-01");
    expect(screen.getByLabelText("Due on or before")).toHaveValue("2026-11-30");
  });

  it("limits the date fields to the allowed range", () => {
    show();
    for (const name of ["Due on or after", "Due on or before"]) {
      const field = screen.getByLabelText(name);
      expect(field).toHaveAttribute("type", "date");
      expect(field).toHaveAttribute("min", "2000-01-01");
      expect(field).toHaveAttribute("max", "2100-12-31");
    }
  });

  it("shows Clear filters only while narrowed, pointing at the plain list", () => {
    const { unmount } = show();
    expect(screen.queryByRole("link", { name: "Clear filters" })).toBeNull();
    unmount();
    show({ status: "done" }, true);
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", href);
  });
});