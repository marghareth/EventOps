// src/modules/events/tasks/ui/TaskForm.test.tsx
// The task form (B6-F01, B6-F02; D-094): add and edit, and after a failed save every problem is
// listed at once in a summary that takes focus, the typed values stay, and a failed request says
// that nothing was saved.
import { render, screen } from "@testing-library/react";
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

beforeEach(() => {
  createTaskAction.mockReset();
  updateTaskAction.mockReset();
});

describe("TaskForm (add)", () => {
  it("shows an empty form with a labelled title and description", () => {
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" />);
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
      values: { title: "", description: "too long" },
    });
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" />);
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
      values: { title: "", description: "Call Ana" },
    });
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" />);
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    await userEvent.click(await screen.findByRole("link", { name: "Enter a task title." }));
    expect(screen.getByLabelText(/Title/)).toHaveFocus();
  });

  it("says nothing was saved when the request fails, with no field errors", async () => {
    createTaskAction.mockResolvedValue({
      status: "error",
      message: "We couldn't save your changes. Nothing was saved. Try again in a moment.",
      values: { title: "Confirm florist", description: "" },
    });
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" />);
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nothing was saved");
    expect(screen.queryByRole("group", { name: "Fix these to continue" })).toBeNull();
    expect(screen.getByLabelText(/Title/)).toHaveValue("Confirm florist");
  });
});

describe("TaskForm (edit)", () => {
  const task = {
    id: "t1",
    reference: "TSK-0004",
    title: "Confirm florist",
    description: "Call Ana",
    version: "2026-10-17T00:00:00.000Z",
  };

  it("shows the stored values, the readable ID and the edit version", () => {
    const { container } = render(
      <TaskForm eventId="e1" cancelHref="/events/e1/tasks" task={task} />,
    );
    expect(screen.getByText("TSK-0004")).toBeVisible();
    expect(screen.getByLabelText(/Title/)).toHaveValue("Confirm florist");
    expect(screen.getByLabelText("Description (optional)")).toHaveValue("Call Ana");
    expect(screen.getByRole("button", { name: "Save task" })).toBeVisible();
    expect(container.querySelector('input[name="version"]')).toHaveValue(task.version);
  });

  it("shows an unchanged result as information, not as an error", async () => {
    updateTaskAction.mockResolvedValue({
      status: "success",
      message: "Nothing changed, so nothing was saved.",
    });
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" task={task} />);
    await userEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Nothing changed");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the stale-save message and keeps what the user typed", async () => {
    updateTaskAction.mockResolvedValue({
      status: "error",
      message:
        "Someone else changed this task while you were editing. Reopen it to see the latest values.",
      values: { title: "My edit", description: "Call Ana" },
    });
    render(<TaskForm eventId="e1" cancelHref="/events/e1/tasks" task={task} />);
    await userEvent.click(screen.getByRole("button", { name: "Save task" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Someone else changed this task");
    expect(screen.getByLabelText(/Title/)).toHaveValue("My edit");
  });
});