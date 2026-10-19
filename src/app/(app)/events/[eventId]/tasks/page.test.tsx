// src/app/(app)/events/[eventId]/tasks/page.test.tsx
// The task list page (B6-F08, B6-F09; D-097): access checked by the page, the list read for the
// authorized event only, filters taken from the address and applied to what was read (so a Viewer
// sees the same filters and no more tasks), the "N of M" count, "No tasks match" with a way back,
// no filters when the event has no tasks, and the Overdue badge worked out from today's date in
// Philippine time (B6-F10, D-098).
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const getEventTasks = vi.fn();

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
  getEventTasks: (...args: unknown[]) => getEventTasks(...args),
  getAssigneeOptions: vi.fn(),
  getTaskForEdit: vi.fn(),
}));
vi.mock("@/modules/events/tasks/actions", () => ({
  createTaskAction: vi.fn(),
  updateTaskAction: vi.fn(),
  deleteTaskAction: vi.fn(),
}));

const { default: TasksPage } = await import("./page");

const EVENT = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const ANA = "b0000000-0000-4000-8000-00000000000a";
const updatedAt = new Date("2026-10-17T00:00:00Z");
const record = (n: number, over: Record<string, unknown> = {}) => ({
  id: `t${n}`,
  number: n,
  title: `Task number ${n}`,
  description: null,
  priority: "MEDIUM",
  status: "NOT_STARTED",
  dueDate: null,
  assignee: null,
  updatedAt,
  ...over,
});
const tasks = [
  record(1, { status: "DONE", priority: "HIGH", assignee: { id: ANA, name: "Ana Reyes" } }),
  record(2, { dueDate: "2026-11-15" }),
  record(3, { priority: "LOW" }),
];

const render_ = async (query: Record<string, string> = {}, canManage = true) => {
  getEventTasks.mockResolvedValue({ ok: true, tasks, canManage });
  render(
    await TasksPage({
      params: Promise.resolve({ eventId: EVENT }),
      searchParams: Promise.resolve(query),
    }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  requireEventAccess.mockResolvedValue({
    user: { id: "u1" },
    access: { kind: "ok", event: { id: EVENT, name: "Santos wedding", role: "OWNER" } },
  });
});

describe("overdue on the task list page (B6-F10)", () => {
  afterEach(() => vi.useRealTimers());

  it("marks a task due yesterday in Manila, not one due today, and never a Done one", async () => {
    // 16:00 UTC on 14 Nov is midnight on 15 Nov in Manila, so 15 Nov is "today".
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-14T16:00:00Z") });
    getEventTasks.mockResolvedValue({
      ok: true,
      canManage: true,
      tasks: [
        record(1, { dueDate: "2026-11-14" }),
        record(2, { dueDate: "2026-11-15" }),
        record(3, { dueDate: "2026-11-14", status: "DONE" }),
      ],
    });
    render(
      await TasksPage({
        params: Promise.resolve({ eventId: EVENT }),
        searchParams: Promise.resolve({}),
      }),
    );
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByText("Overdue")).toBeVisible();
    expect(within(items[1]!).queryByText("Overdue")).toBeNull();
    expect(within(items[2]!).queryByText("Overdue")).toBeNull();
  });

  it("is still marked for a Viewer, and by the filtered list too", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-20T00:00:00Z") });
    getEventTasks.mockResolvedValue({
      ok: true,
      canManage: false,
      tasks: [record(1, { dueDate: "2026-11-14", priority: "HIGH" }), record(2)],
    });
    render(
      await TasksPage({
        params: Promise.resolve({ eventId: EVENT }),
        searchParams: Promise.resolve({ priority: "high" }),
      }),
    );
    expect(screen.getByText("Overdue")).toBeVisible();
  });
});

describe("the task list page", () => {
  it("checks access, then reads the tasks of the authorized event only", async () => {
    await render_();
    expect(requireEventAccess).toHaveBeenCalledWith(EVENT);
    expect(getEventTasks).toHaveBeenCalledWith(EVENT);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("search", { name: "Filter tasks" })).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows every task and no count when the address has no valid filter", async () => {
    await render_({ status: "blocked", priority: "urgent", dueFrom: "2026-02-30" });
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("link", { name: "Clear filters" })).toBeNull();
  });

  it("narrows the list from the address and says how many match", async () => {
    await render_({ status: "not-started" });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("2 of 3 tasks match.");
    expect(screen.getByLabelText("Status")).toHaveValue("not-started");
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      `/events/${EVENT}/tasks`,
    );
  });

  it("combines filters, including Unassigned and a due date range", async () => {
    await render_({ assignee: "unassigned", dueFrom: "2026-11-01" });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]!).getByText("Task number 2")).toBeVisible();
  });

  it("filters by an assignee who has a task, and offers only such members", async () => {
    await render_({ assignee: ANA });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    const options = within(screen.getByLabelText("Assigned to")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Anyone", "Unassigned", "Ana Reyes"]);
  });

  it("ignores an assignee ID that is not in this event's list", async () => {
    await render_({ assignee: "b0000000-0000-4000-8000-0000000000ff" });
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("says no tasks match, names the filters and offers a way back", async () => {
    await render_({ status: "done", priority: "low" });
    expect(screen.getByRole("heading", { name: "No tasks match" })).toBeVisible();
    expect(screen.getByText(/Status: Done · Priority: Low\./)).toBeVisible();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Clear filters" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent("0 of 3 tasks match.");
  });

  it("gives a Viewer the same filters and no Add task button", async () => {
    await render_({ priority: "high" }, false);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("search", { name: "Filter tasks" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Add task" })).toBeNull();
  });

  it("shows the empty state and no filters when the event has no tasks", async () => {
    getEventTasks.mockResolvedValue({ ok: true, tasks: [], canManage: true });
    render(
      await TasksPage({
        params: Promise.resolve({ eventId: EVENT }),
        searchParams: Promise.resolve({ status: "done" }),
      }),
    );
    expect(screen.getByRole("heading", { name: "No tasks yet" })).toBeVisible();
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("tells a Viewer who can add tasks when the list is empty, without an Add button", async () => {
    getEventTasks.mockResolvedValue({ ok: true, tasks: [], canManage: false });
    render(
      await TasksPage({
        params: Promise.resolve({ eventId: EVENT }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByText("Owners and Coordinators can add tasks to this event.")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Add/ })).toBeNull();
  });

  it("shows the refused screen, with no filters, when reading is not allowed", async () => {
    getEventTasks.mockResolvedValue({ ok: false, reason: "forbidden" });
    render(
      await TasksPage({
        params: Promise.resolve({ eventId: EVENT }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});