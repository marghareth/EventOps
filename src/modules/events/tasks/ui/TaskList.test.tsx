// src/modules/events/tasks/ui/TaskList.test.tsx
// The task list (B6-F01, B6-F02; D-094): readable ID, title and description for everyone; Edit only
// for people who can manage tasks.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskRecord } from "../application/ports";
import { TaskList } from "./TaskList";

const updatedAt = new Date("2026-10-17T00:00:00Z");
const tasks: TaskRecord[] = [
  { id: "t1", number: 1, title: "Confirm florist", description: "Call Ana", updatedAt },
  { id: "t2", number: 12, title: "Print programs", description: null, updatedAt },
];

const renderList = (canManage = true, list = tasks) =>
  render(<TaskList tasks={list} basePath="/events/e1/tasks" canManage={canManage} />);

describe("TaskList", () => {
  it("shows each task as a list item with its readable ID, title and description", () => {
    renderList();
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("TSK-0001")).toBeVisible();
    expect(within(items[0]!).getByRole("heading", { name: "Confirm florist" })).toBeVisible();
    expect(within(items[0]!).getByText("Call Ana")).toBeVisible();
    expect(within(items[1]!).getByText("TSK-0012")).toBeVisible();
  });

  it("shows no description line for a task without one", () => {
    renderList();
    const second = screen.getAllByRole("listitem")[1]!;
    expect(second.querySelectorAll("p")).toHaveLength(1); // only the readable ID
  });

  it("gives each Edit link a name that says which task, pointing at its edit page", () => {
    renderList();
    const link = screen.getByRole("link", { name: "Edit TSK-0001 Confirm florist" });
    expect(link).toHaveAttribute("href", "/events/e1/tasks/t1/edit");
  });

  it("shows no Edit link to someone who cannot manage tasks", () => {
    renderList(false);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.getByText("Confirm florist")).toBeVisible();
  });

  it("shows text as text, never as markup", () => {
    renderList(true, [
      { ...tasks[0]!, title: "<img src=x onerror=alert(1)>", description: "<b>bold</b>" },
    ]);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("b")).toBeNull();
    expect(screen.getByText("<b>bold</b>")).toBeVisible();
  });
});