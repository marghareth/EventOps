// src/modules/events/tasks/ui/TaskForm.test.tsx
// The task form (B6-F01 to B6-F05; D-094, D-095): add and edit, and after a failed save every problem is
// listed at once in a summary that takes focus, the typed values stay, and a failed request says
// that nothing was saved.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskFormState } from "../form-state";

const createTaskAction = vi.fn<(...args: unknown[]) => Promise<TaskFormState>>();
const updateTaskAction = vi.fn<(...args: unknown[]) => Promise<TaskFormState>>();
vi.mock("../actions", () => ({
  createTaskAction: (...args: unknown[]) => createTaskAction(...args),
  updateTaskAction: (...args: unknown[]) => updateTaskAction(...args),
}));

const { TaskForm } = await import("./TaskForm");

const assignees = [
  { id: "m1", label: "Ana Reyes (Coordinator)" },
  { id: "m2", label: "Mika Santos (Owner)" },
];

beforeEach(() => {
  createTaskAction.mockReset();
  updateTaskAction.mockReset();
});

describe("TaskForm (add)", () => {
  it("shows an empty form with a labelled title and description", () => {
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} />);
    expect(screen.getByLabelText(/Title/)).toHaveValue("");
    expect(screen.getByLabelText("Description (optional)")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Add task" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/events/e1/tasks",
    );
    expect(screen.queryByRole("group", { name: "Fix these to continue" })).toBeNull();
  });

  it("lists every problem at once, focuses the summary and keeps what was typed", async () => {
    createTaskAction.mockResolvedValue({
      status: "error",
      fieldErrors: {
        title: "Enter a task title.",
        description: "Keep the description to 2000 characters or fewer.",
      },
      values: {
        title: "",
        description: "too long",
        priority: "MEDIUM",
        status: "NOT_STARTED",
        dueDate: "",
        assigneeId: "",
      },
    });
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} />);
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));

    const summary = await screen.findByRole("group", { name: "Fix these to continue" });
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent("Enter a task title.");
    expect(summary).toHaveTextContent("Keep the description to 2000 characters or fewer.");
    expect(screen.getByLabelText(/Title/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Description (optional)")).toHaveValue("too long");
  });

  it("jumps from a summary line to its field", async () => {
    createTaskAction.mockResolvedValue({
      status: "error",
      fieldErrors: { title: "Enter a task title." },
      values: {
        title: "",
        description: "Call Ana",
        priority: "MEDIUM",
        status: "NOT_STARTED",
        dueDate: "",
        assigneeId: "",
      },
    });
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} />);
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    await userEvent.click(await screen.findByRole("link", { name: "Enter a task title." }));
    expect(screen.getByLabelText(/Title/)).toHaveFocus();
  });

  it("says nothing was saved when the request fails, with no field errors", async () => {
    createTaskAction.mockResolvedValue({
      status: "error",
      message: "We couldn't save your changes. Nothing was saved. Try again in a moment.",
      values: {
        title: "Confirm florist",
        description: "",
        priority: "MEDIUM",
        status: "NOT_STARTED",
        dueDate: "",
        assigneeId: "",
      },
    });
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} />);
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nothing was saved");
    expect(screen.queryByRole("group", { name: "Fix these to continue" })).toBeNull();
    expect(screen.getByLabelText(/Title/)).toHaveValue("Confirm florist");
  });
});

describe("TaskForm priority and assignee (B6-F04, B6-F05)", () => {
  it("starts a new task at Medium priority and unassigned", () => {
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} />);
    expect(screen.getByLabelText(/Priority/)).toHaveValue("MEDIUM");
    expect(screen.getByLabelText("Assigned to (optional)")).toHaveValue("");
  });

  it("offers High, Medium and Low in that order", () => {
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} />);
    const options = within(screen.getByLabelText(/Priority/)).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["High", "Medium", "Low"]);
  });

  it("offers Unassigned and then this event's members, named with their role", () => {
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} />);
    const options = within(screen.getByLabelText("Assigned to (optional)")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Unassigned",
      "Ana Reyes (Coordinator)",
      "Mika Santos (Owner)",
    ]);
    expect(options.map((option) => (option as HTMLOptionElement).value)).toEqual(["", "m1", "m2"]);
  });

  it("lists a priority and an assignee error in the summary and marks the fields", async () => {
    createTaskAction.mockResolvedValue({
      status: "error",
      fieldErrors: {
        priority: "Choose a priority.",
        assigneeId: "Choose a member of this event.",
      },
      values: {
        title: "A",
        description: "",
        priority: "MEDIUM",
        status: "NOT_STARTED",
        dueDate: "",
        assigneeId: "m1",
      },
    });
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} />);
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    const summary = await screen.findByRole("group", { name: "Fix these to continue" });
    expect(summary).toHaveTextContent("Choose a priority.");
    expect(summary).toHaveTextContent("Choose a member of this event.");
    expect(screen.getByLabelText(/Priority/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Assigned to (optional)")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Assigned to (optional)")).toHaveValue("m1");
  });
});

describe("TaskForm status and due date (B6-F06, B6-F07)", () => {
  it("starts a new task as Not started with no due date", () => {
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} />);
    expect(screen.getByLabelText(/Status/)).toHaveValue("NOT_STARTED");
    expect(screen.getByLabelText("Due date (optional)")).toHaveValue("");
  });

  it("offers Not started, In progress and Done in that order", () => {
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} />);
    const options = within(screen.getByLabelText(/Status/)).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Not started",
      "In progress",
      "Done",
    ]);
  });

  it("uses a date field limited to the allowed range", () => {
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} />);
    const field = screen.getByLabelText("Due date (optional)");
    expect(field).toHaveAttribute("type", "date");
    expect(field).toHaveAttribute("min", "2000-01-01");
    expect(field).toHaveAttribute("max", "2100-12-31");
  });

  it("lists a due date error in the summary and marks the field", async () => {
    createTaskAction.mockResolvedValue({
      status: "error",
      fieldErrors: { dueDate: "Enter a real date, for example 2026-11-15." },
      values: {
        title: "A",
        description: "",
        priority: "MEDIUM",
        status: "NOT_STARTED",
        dueDate: "",
        assigneeId: "",
      },
    });
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} />);
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    const summary = await screen.findByRole("group", { name: "Fix these to continue" });
    expect(summary).toHaveTextContent("Enter a real date, for example 2026-11-15.");
    expect(screen.getByLabelText("Due date (optional)")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("TaskForm (edit)", () => {
  const task = {
    id: "t1",
    reference: "TSK-0004",
    title: "Confirm florist",
    description: "Call Ana",
    priority: "HIGH" as const,
    status: "IN_PROGRESS" as const,
    dueDate: "2026-11-15" as string | null,
    assigneeId: "m2" as string | null,
    version: "2026-10-17T00:00:00.000Z",
  };

  it("shows the stored values, the readable ID and the edit version", () => {
    const { container } = render(
      <TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} task={task} />,
    );
    expect(screen.getByText("TSK-0004")).toBeVisible();
    expect(screen.getByLabelText(/Title/)).toHaveValue("Confirm florist");
    expect(screen.getByLabelText("Description (optional)")).toHaveValue("Call Ana");
    expect(screen.getByLabelText(/Priority/)).toHaveValue("HIGH");
    expect(screen.getByLabelText("Assigned to (optional)")).toHaveValue("m2");
    expect(screen.getByRole("button", { name: "Save task" })).toBeVisible();
    expect(container.querySelector('input[name="version"]')).toHaveValue(task.version);
  });

  it("shows an unchanged result as information, not as an error", async () => {
    updateTaskAction.mockResolvedValue({
      status: "success",
      message: "Nothing changed, so nothing was saved.",
    });
    render(
      <TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} task={task} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Nothing changed");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the stale-save message and keeps what the user typed", async () => {
    updateTaskAction.mockResolvedValue({
      status: "error",
      message:
        "Someone else changed this task while you were editing. Reopen it to see the latest values.",
      values: {
        title: "My edit",
        description: "Call Ana",
        priority: "HIGH",
        status: "NOT_STARTED",
        dueDate: "",
        assigneeId: "m2",
      },
    });
    render(
      <TaskForm eventId="e1" cancelHref="/events/e1/tasks" assignees={assignees} task={task} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Someone else changed this task");
    expect(screen.getByLabelText(/Title/)).toHaveValue("My edit");
  });
});