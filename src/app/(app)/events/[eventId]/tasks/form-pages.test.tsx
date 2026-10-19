// src/app/(app)/events/[eventId]/tasks/form-pages.test.tsx
// The Add task and Edit task pages (B6-F02, B6-F12; D-094): membership checked by each page; the
// form only for Owners and Coordinators (a Viewer gets the "not allowed" screen and nothing is
// loaded for them); the task looked up only inside the authorized event, so another event's task,
// a malformed ID or a refused read is a 404 and never shows a form.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const getAssigneeOptions = vi.fn();
const getTaskForEdit = vi.fn();
const notFound = vi.fn(() => {
  throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });
});

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: () => notFound(),
}));
vi.mock("@/modules/events/access", () => ({
  requireEventAccess: (...args: unknown[]) => requireEventAccess(...args),
  getEventAccess: vi.fn(),
}));
vi.mock("@/modules/events/actions", () => ({
  createEventAction: vi.fn(),
  updateEventAction: vi.fn(),
  deleteEventAction: vi.fn(),
}));
vi.mock("@/modules/events/queries", () => ({ getMyEvents: vi.fn() }));
vi.mock("@/modules/events/tasks/queries", () => ({
  getEventTasks: vi.fn(),
  getAssigneeOptions: (...args: unknown[]) => getAssigneeOptions(...args),
  getTaskForEdit: (...args: unknown[]) => getTaskForEdit(...args),
}));
vi.mock("@/modules/events/tasks/actions", () => ({
  createTaskAction: vi.fn(),
  updateTaskAction: vi.fn(),
  deleteTaskAction: vi.fn(),
}));

const { default: NewTaskPage } = await import("./new/page");
const { default: EditTaskPage } = await import("./[taskId]/edit/page");

const EVENT = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const TASK = "7a1d2c3b-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const assignees = [{ id: "m1", label: "Ana Reyes (Coordinator)" }];
const record = {
  id: TASK,
  number: 4,
  title: "Confirm florist",
  description: null,
  priority: "MEDIUM",
  status: "IN_PROGRESS",
  dueDate: "2026-11-15",
  assignee: null,
  updatedAt: new Date("2026-10-17T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  requireEventAccess.mockResolvedValue({
    user: { id: "u1" },
    access: { kind: "ok", event: { id: EVENT, name: "Santos wedding", role: "OWNER" } },
  });
});

describe("the Add task page", () => {
  const open = async () =>
    render(await NewTaskPage({ params: Promise.resolve({ eventId: EVENT }) }));

  it("checks membership, then shows the form with this event's members to choose from", async () => {
    getAssigneeOptions.mockResolvedValue({ ok: true, assignees });
    await open();
    expect(requireEventAccess).toHaveBeenCalledWith(EVENT);
    expect(getAssigneeOptions).toHaveBeenCalledWith(EVENT);
    expect(screen.getByRole("heading", { level: 1, name: "Add task" })).toBeVisible();
    expect(screen.getByLabelText("Assigned to (optional)")).toBeVisible();
  });

  it("shows a Viewer the not-allowed screen and no form", async () => {
    getAssigneeOptions.mockResolvedValue({ ok: false, reason: "forbidden" });
    await open();
    expect(screen.queryByRole("heading", { name: "Add task" })).toBeNull();
    expect(screen.queryByLabelText(/Title/)).toBeNull();
    expect(screen.getByRole("link", { name: "Back to the tasks" })).toHaveAttribute(
      "href",
      `/events/${EVENT}/tasks`,
    );
  });

  it("is a 404 when the event is not found for this person", async () => {
    getAssigneeOptions.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(open()).rejects.toMatchObject({ notFound: true });
  });

  it("is a 404 for a non-member, before anything is loaded", async () => {
    requireEventAccess.mockRejectedValue(
      Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }),
    );
    await expect(open()).rejects.toMatchObject({ notFound: true });
    expect(getAssigneeOptions).not.toHaveBeenCalled();
  });
});

describe("the Edit task page", () => {
  const open = async (taskId = TASK) =>
    render(await EditTaskPage({ params: Promise.resolve({ eventId: EVENT, taskId }) }));

  it("looks the task up inside the authorized event and fills the form with it", async () => {
    getTaskForEdit.mockResolvedValue({ ok: true, task: record, assignees });
    await open();
    expect(getTaskForEdit).toHaveBeenCalledWith(EVENT, TASK);
    expect(screen.getByRole("heading", { level: 1, name: "Edit task" })).toBeVisible();
    expect(screen.getByLabelText(/Title/)).toHaveValue("Confirm florist");
    expect(screen.getByLabelText(/Status/)).toHaveValue("IN_PROGRESS");
    expect(screen.getByLabelText("Due date (optional)")).toHaveValue("2026-11-15");
  });

  it("shows a Viewer the not-allowed screen and no form", async () => {
    getTaskForEdit.mockResolvedValue({ ok: false, reason: "forbidden" });
    await open();
    expect(screen.queryByRole("heading", { name: "Edit task" })).toBeNull();
    expect(screen.queryByLabelText(/Title/)).toBeNull();
  });

  it("is a 404 for another event's task or a malformed ID", async () => {
    getTaskForEdit.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(open("a-task-of-another-event")).rejects.toMatchObject({ notFound: true });
  });

  it("is a 404 for a non-member, before anything is loaded", async () => {
    requireEventAccess.mockRejectedValue(
      Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }),
    );
    await expect(open()).rejects.toMatchObject({ notFound: true });
    expect(getTaskForEdit).not.toHaveBeenCalled();
  });
});