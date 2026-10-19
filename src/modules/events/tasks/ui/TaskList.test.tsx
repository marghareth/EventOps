// src/modules/events/tasks/ui/TaskList.test.tsx
// The task list (B6-F01 to B6-F05; D-094, D-095): readable ID, title, description, priority and
// assignee for everyone; Edit and Delete only for people who can manage tasks.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskRecord } from "../application/ports";
vi.mock("../actions", () => ({ deleteTaskAction: vi.fn() }));

const { TaskList } = await import("./TaskList");

const updatedAt = new Date("2026-10-17T00:00:00Z");
const tasks: TaskRecord[] = [
  {
    id: "t1",
    number: 1,
    title: "Confirm florist",
    description: "Call Ana",
    priority: "HIGH",
    status: "IN_PROGRESS",
    dueDate: "2026-11-15",
    assignee: { id: "m1", name: "Ana Reyes" },
    updatedAt,
  },
  {
    id: "t2",
    number: 12,
    title: "Print programs",
    description: null,
    priority: "LOW",
    status: "NOT_STARTED",
    dueDate: null,
    assignee: null,
    updatedAt,
  },
];

const TODAY = "2026-11-16";
const renderList = (canManage = true, list = tasks, today = "2026-10-18") =>
  render(
    <TaskList
      tasks={list}
      eventId="e1"
      basePath="/events/e1/tasks"
      canManage={canManage}
      today={today}
    />,
  );

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
    expect(second.querySelectorAll("p")).toHaveLength(2); // the readable ID and the priority line
  });

  it("gives each Edit link a name that says which task, pointing at its edit page", () => {
    renderList();
    const link = screen.getByRole("link", { name: "Edit TSK-0001 Confirm florist" });
    expect(link).toHaveAttribute("href", "/events/e1/tasks/t1/edit");
  });

  it("shows the status as a word and the due date, or that there is none (B6-F06, B6-F07)", () => {
    renderList(false);
    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first!).getByText("In progress")).toBeVisible();
    expect(within(first!).getByText("Nov 15, 2026")).toBeVisible();
    expect(within(second!).getByText("Not started")).toBeVisible();
    expect(within(second!).getByText("No due date")).toBeVisible();
  });

  it("shows the priority as a word, never colour alone (B6-F05)", () => {
    renderList();
    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first!).getByText("High priority")).toBeVisible();
    expect(within(second!).getByText("Low priority")).toBeVisible();
  });

  it("shows who a task is assigned to, or that it is unassigned (B6-F04)", () => {
    renderList();
    const [first, second] = screen.getAllByRole("listitem");
    expect(first).toHaveTextContent("Assigned to Ana Reyes");
    expect(second).toHaveTextContent("Unassigned");
  });

  it("gives each task a Delete button that names the task (B6-F03)", () => {
    renderList();
    expect(screen.getByRole("button", { name: "Delete TSK-0001 Confirm florist" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete TSK-0012 Print programs" })).toBeVisible();
  });

  it("shows no Edit link or Delete button to someone who cannot manage tasks", () => {
    renderList(false);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.queryByText("Delete")).toBeNull();
    expect(screen.getByText("High priority")).toBeVisible();
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

describe("TaskList overdue (B6-F10)", () => {
  const open = (id: string, dueDate: string | null, status: TaskRecord["status"]): TaskRecord => ({
    ...tasks[1]!,
    id,
    number: Number(id),
    title: `Task ${id}`,
    status,
    dueDate,
  });
  const list = [
    open("1", "2026-11-15", "IN_PROGRESS"), // due yesterday, not done
    open("2", "2026-11-16", "NOT_STARTED"), // due today
    open("3", "2026-11-15", "DONE"), // due yesterday but done
    open("4", null, "NOT_STARTED"), // no due date
  ];

  it("marks only a task that is not Done and past its due date, with a word", () => {
    renderList(false, list, TODAY);
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByText("Overdue")).toBeVisible();
    for (const item of items.slice(1)) expect(within(item).queryByText("Overdue")).toBeNull();
  });

  it("marks nothing when no task is past due", () => {
    renderList(false, list, "2026-11-15");
    expect(screen.queryByText("Overdue")).toBeNull();
  });

  it("marks a task overdue the moment Philippine midnight passes", () => {
    renderList(false, [list[1]!], "2026-11-17");
    expect(screen.getByText("Overdue")).toBeVisible();
  });
});