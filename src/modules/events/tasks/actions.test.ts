// src/modules/events/tasks/actions.test.ts
// @vitest-environment node
// Task server actions (B6-F01 to B6-F05; D-035, D-036, D-094, D-095) with authorization, storage and Next.js
// replaced. Each action authorizes before it reads the form or touches storage; uses only the IDs
// authorization returned, never form fields; validates on the server; and fails safely.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TASK_MESSAGES } from "./form-state";

vi.mock("server-only", () => ({}));

const authorizeEvent = vi.fn();
vi.mock("@/modules/events/public", () => ({
  authorizeEvent: (...args: unknown[]) => authorizeEvent(...args),
}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  },
}));

const repository = {
  listTasks: vi.fn(),
  findTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  findAssignableMember: vi.fn(),
};
vi.mock("./composition", () => ({ taskRepository: () => repository }));

const { createTaskAction, deleteTaskAction, updateTaskAction } = await import("./actions");

const EVENT = "e0000000-0000-4000-8000-00000000000a";
const OTHER_EVENT = "e0000000-0000-4000-8000-00000000000b";
const TASK = "10000000-0000-4000-8000-00000000000a";
const VERSION = "2026-10-17T00:00:00.000Z";
const ANA = "b0000000-0000-4000-8000-00000000000a";
const OTHER_EVENT_MEMBER = "b0000000-0000-4000-8000-0000000000ff";
const USER = { id: "u0000000-0000-4000-8000-00000000000a", email: "mika@example.test" };
const idle = { status: "idle" } as const;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const fields = {
  title: "Confirm florist",
  description: "Call Ana",
  priority: "MEDIUM",
  status: "NOT_STARTED",
  dueDate: "",
  assigneeId: "",
};
const allowed = { ok: true, event: { id: EVENT }, user: USER };

/** The redirect URL an action threw, or null when it returned normally. */
async function redirectedTo(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return (error as { url?: string }).url ?? null;
  }
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeEvent.mockResolvedValue(allowed);
  repository.findTask.mockResolvedValue({
    id: TASK,
    number: 4,
    title: "Confirm florist",
    description: "Call Ana",
    priority: "MEDIUM",
    status: "NOT_STARTED",
    dueDate: null,
    assignee: null,
    updatedAt: new Date(VERSION),
  });
  repository.findAssignableMember.mockImplementation(async (_event: string, id: string) =>
    id === ANA ? { id: ANA, name: "Ana Reyes", role: "COORDINATOR" } : null,
  );
  repository.createTask.mockResolvedValue({ ok: true, id: TASK, number: 7 });
  repository.updateTask.mockResolvedValue({ ok: true });
  repository.deleteTask.mockResolvedValue({ ok: true, number: 4, title: "Confirm florist" });
});

describe("createTaskAction", () => {
  it("authorizes tasks.manage for the bound event, then adds the task and opens the list", async () => {
    const url = await redirectedTo(() => createTaskAction(EVENT, idle, form(fields)));
    expect(authorizeEvent).toHaveBeenCalledWith(EVENT, "tasks.manage", `/events/${EVENT}/tasks`);
    expect(repository.createTask).toHaveBeenCalledWith({
      eventId: EVENT,
      actorId: USER.id,
      input: {
        title: "Confirm florist",
        description: "Call Ana",
        priority: "MEDIUM",
        status: "NOT_STARTED",
        dueDate: null,
        assigneeId: null,
      },
    });
    expect(url).toBe(`/events/${EVENT}/tasks?notice=task-added&ref=TSK-0007`);
    expect(revalidatePath).toHaveBeenCalledWith(`/events/${EVENT}/tasks`);
  });

  it.each([
    ["not-found", TASK_MESSAGES.eventNotFound],
    ["forbidden", TASK_MESSAGES.forbidden],
  ] as const)("refuses (%s) before touching storage", async (reason, message) => {
    authorizeEvent.mockResolvedValue({ ok: false, reason });
    const state = await createTaskAction(EVENT, idle, form(fields));
    expect(state).toMatchObject({ status: "error", message });
    expect(repository.createTask).not.toHaveBeenCalled();
  });

  it("uses the event authorization returned, never an event ID from the form", async () => {
    await redirectedTo(() =>
      createTaskAction(EVENT, idle, form({ ...fields, eventId: OTHER_EVENT, number: "99" })),
    );
    expect(repository.createTask).toHaveBeenCalledWith(expect.objectContaining({ eventId: EVENT }));
  });

  it("returns every field error at once and keeps what was typed, saving nothing", async () => {
    const state = await createTaskAction(
      EVENT,
      idle,
      form({
        title: "   ",
        description: "x".repeat(2001),
        priority: "URGENT",
        status: "BLOCKED",
        dueDate: "2026-02-30",
        assigneeId: "ana",
      }),
    );
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: {
        title: "Enter a task title.",
        description: "Keep the description to 2000 characters or fewer.",
        priority: "Choose a priority.",
        status: "Choose a status.",
        dueDate: "Enter a real date, for example 2026-11-15.",
        assigneeId: "Choose a member of this event.",
      },
      values: { title: "   " },
    });
    expect(repository.createTask).not.toHaveBeenCalled();
  });

  it("says the role was refused when it changed after the check", async () => {
    repository.createTask.mockResolvedValue({ ok: false, reason: "not-found" });
    const state = await createTaskAction(EVENT, idle, form(fields));
    expect(state).toMatchObject({ status: "error", message: TASK_MESSAGES.forbidden });
  });

  it("says nothing was saved when storage fails, without the error's own text", async () => {
    repository.createTask.mockRejectedValue(new Error('relation "tasks" does not exist'));
    const state = await createTaskAction(EVENT, idle, form(fields));
    expect(state).toMatchObject({ status: "error", message: TASK_MESSAGES.saveFailed });
    expect(JSON.stringify(state)).not.toContain("relation");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createTaskAction: priority and assignee (B6-F04, B6-F05)", () => {
  it("saves the chosen priority and a member as the assignee", async () => {
    await redirectedTo(() =>
      createTaskAction(EVENT, idle, form({ ...fields, priority: "HIGH", assigneeId: ANA })),
    );
    expect(repository.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ priority: "HIGH", assigneeId: ANA }),
      }),
    );
  });

  it("refuses a missing priority and saves nothing", async () => {
    const state = await createTaskAction(EVENT, idle, form({ title: "A" }));
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { priority: "Choose a priority." },
    });
    expect(repository.createTask).not.toHaveBeenCalled();
  });

  it("shows an assignee from another event as a field error, keeping what was typed", async () => {
    repository.createTask.mockResolvedValue({ ok: false, reason: "assignee-not-found" });
    const state = await createTaskAction(
      EVENT,
      idle,
      form({ ...fields, assigneeId: OTHER_EVENT_MEMBER }),
    );
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { assigneeId: TASK_MESSAGES.assigneeNotFound },
      values: { title: "Confirm florist", assigneeId: OTHER_EVENT_MEMBER },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateTaskAction", () => {
  const edit = (extra: Record<string, string> = {}, taskId = TASK) =>
    updateTaskAction(EVENT, taskId, idle, form({ ...fields, version: VERSION, ...extra }));

  it("saves a change and opens the list with a saved notice for that task", async () => {
    const url = await redirectedTo(() => edit({ title: "Confirm both florists" }));
    expect(repository.updateTask).toHaveBeenCalledWith({
      eventId: EVENT,
      taskId: TASK,
      actorId: USER.id,
      version: new Date(VERSION),
      input: {
        title: "Confirm both florists",
        description: "Call Ana",
        priority: "MEDIUM",
        status: "NOT_STARTED",
        dueDate: null,
        assigneeId: null,
      },
      changes: { title: { from: "Confirm florist", to: "Confirm both florists" } },
    });
    expect(url).toBe(`/events/${EVENT}/tasks?notice=task-saved&ref=TSK-0004`);
  });

  it("says nothing changed and records nothing when the values are the same", async () => {
    const state = await edit();
    expect(state).toEqual({ status: "success", message: TASK_MESSAGES.unchanged });
    expect(repository.updateTask).not.toHaveBeenCalled();
  });

  it.each([
    ["not-found", TASK_MESSAGES.eventNotFound],
    ["forbidden", TASK_MESSAGES.forbidden],
  ] as const)("refuses (%s) before reading the task", async (reason, message) => {
    authorizeEvent.mockResolvedValue({ ok: false, reason });
    const state = await edit({ title: "New" });
    expect(state).toMatchObject({ status: "error", message });
    expect(repository.findTask).not.toHaveBeenCalled();
    expect(repository.updateTask).not.toHaveBeenCalled();
  });

  it("looks the task up only inside the authorized event", async () => {
    await redirectedTo(() => edit({ title: "New" }));
    expect(repository.findTask).toHaveBeenCalledWith(EVENT, TASK);
  });

  it("treats a malformed task ID as not found", async () => {
    const state = await edit({ title: "New" }, "not-a-uuid");
    expect(state).toMatchObject({ status: "error", message: TASK_MESSAGES.taskNotFound });
    expect(repository.findTask).not.toHaveBeenCalled();
  });

  it("treats a task outside the event as not found", async () => {
    repository.findTask.mockResolvedValue(null);
    const state = await edit({ title: "New" });
    expect(state).toMatchObject({ status: "error", message: TASK_MESSAGES.taskNotFound });
    expect(repository.updateTask).not.toHaveBeenCalled();
  });

  it("refuses a missing or malformed edit version as stale", async () => {
    for (const version of ["", "yesterday"]) {
      const state = await edit({ title: "New", version });
      expect(state).toMatchObject({ status: "error", message: TASK_MESSAGES.taskStale });
    }
    expect(repository.updateTask).not.toHaveBeenCalled();
  });

  it("tells the user when someone else saved first", async () => {
    repository.updateTask.mockResolvedValue({ ok: false, reason: "stale" });
    const state = await edit({ title: "New" });
    expect(state).toMatchObject({
      status: "error",
      message: TASK_MESSAGES.taskStale,
      values: { title: "New" },
    });
  });

  it("returns field errors and saves nothing for an invalid title", async () => {
    const state = await edit({ title: "" });
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { title: "Enter a task title." },
    });
    expect(repository.updateTask).not.toHaveBeenCalled();
  });

  it("says nothing was saved when storage fails", async () => {
    repository.updateTask.mockRejectedValue(new Error("connection refused 10.0.0.5:5432"));
    const state = await edit({ title: "New" });
    expect(state).toMatchObject({ status: "error", message: TASK_MESSAGES.saveFailed });
    expect(JSON.stringify(state)).not.toContain("10.0.0.5");
  });
});

describe("updateTaskAction: status and due date (B6-F06, B6-F07)", () => {
  const edit = (extra: Record<string, string>) =>
    updateTaskAction(EVENT, TASK, idle, form({ ...fields, version: VERSION, ...extra }));

  it("saves a new status and records it old → new", async () => {
    const url = await redirectedTo(() => edit({ status: "IN_PROGRESS" }));
    expect(repository.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ status: "IN_PROGRESS" }),
        changes: { status: { from: "NOT_STARTED", to: "IN_PROGRESS" } },
      }),
    );
    expect(url).toBe(`/events/${EVENT}/tasks?notice=task-saved&ref=TSK-0004`);
  });

  it("sets a due date and records it", async () => {
    await redirectedTo(() => edit({ dueDate: "2026-11-15" }));
    expect(repository.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ dueDate: "2026-11-15" }),
        changes: { dueDate: { from: null, to: "2026-11-15" } },
      }),
    );
  });

  it("clears a due date when the field is emptied", async () => {
    repository.findTask.mockResolvedValue({
      id: TASK,
      number: 4,
      title: "Confirm florist",
      description: "Call Ana",
      priority: "MEDIUM",
      status: "NOT_STARTED",
      dueDate: "2026-11-15",
      assignee: null,
      updatedAt: new Date(VERSION),
    });
    await redirectedTo(() => edit({ dueDate: "" }));
    expect(repository.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ changes: { dueDate: { from: "2026-11-15", to: null } } }),
    );
  });

  it("refuses an impossible date and writes nothing", async () => {
    const state = await edit({ dueDate: "2026-02-30" });
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { dueDate: "Enter a real date, for example 2026-11-15." },
    });
    expect(repository.updateTask).not.toHaveBeenCalled();
  });
});

describe("updateTaskAction: priority and assignee (B6-F04, B6-F05)", () => {
  const edit = (extra: Record<string, string>) =>
    updateTaskAction(EVENT, TASK, idle, form({ ...fields, version: VERSION, ...extra }));

  it("saves a new priority and records it old → new", async () => {
    const url = await redirectedTo(() => edit({ priority: "HIGH" }));
    expect(repository.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ priority: "HIGH" }),
        changes: { priority: { from: "MEDIUM", to: "HIGH" } },
      }),
    );
    expect(url).toBe(`/events/${EVENT}/tasks?notice=task-saved&ref=TSK-0004`);
  });

  it("assigns a member of the authorized event", async () => {
    await redirectedTo(() => edit({ assigneeId: ANA }));
    expect(repository.findAssignableMember).toHaveBeenCalledWith(EVENT, ANA);
    expect(repository.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: { assignee: { from: null, to: "Ana Reyes" } },
      }),
    );
  });

  it("refuses a member ID from another event before anything is written", async () => {
    const state = await edit({ assigneeId: OTHER_EVENT_MEMBER });
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { assigneeId: TASK_MESSAGES.assigneeNotFound },
    });
    expect(repository.findAssignableMember).toHaveBeenCalledWith(EVENT, OTHER_EVENT_MEMBER);
    expect(repository.updateTask).not.toHaveBeenCalled();
  });

  it("shows a refusal from storage on the assignee field too", async () => {
    repository.updateTask.mockResolvedValue({ ok: false, reason: "assignee-not-found" });
    const state = await edit({ assigneeId: ANA });
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { assigneeId: TASK_MESSAGES.assigneeNotFound },
    });
  });

  it("unassigns when the choice is blank", async () => {
    repository.findTask.mockResolvedValue({
      id: TASK,
      number: 4,
      title: "Confirm florist",
      description: "Call Ana",
      priority: "MEDIUM",
      status: "NOT_STARTED",
      dueDate: null,
      assignee: { id: ANA, name: "Ana Reyes" },
      updatedAt: new Date(VERSION),
    });
    await redirectedTo(() => edit({ assigneeId: "" }));
    expect(repository.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ changes: { assignee: { from: "Ana Reyes", to: null } } }),
    );
  });
});

describe("deleteTaskAction (B6-F03)", () => {
  it("authorizes tasks.manage for the bound event, removes the task and opens the list", async () => {
    const url = await redirectedTo(() => deleteTaskAction(EVENT, TASK));
    expect(authorizeEvent).toHaveBeenCalledWith(EVENT, "tasks.manage", `/events/${EVENT}/tasks`);
    expect(repository.deleteTask).toHaveBeenCalledWith({
      eventId: EVENT,
      taskId: TASK,
      actorId: USER.id,
    });
    expect(url).toBe(`/events/${EVENT}/tasks?notice=task-removed&ref=TSK-0004`);
    expect(revalidatePath).toHaveBeenCalledWith(`/events/${EVENT}/tasks`);
  });

  it.each([
    ["not-found", TASK_MESSAGES.eventNotFound],
    ["forbidden", TASK_MESSAGES.forbidden],
  ] as const)("refuses (%s) before touching storage", async (reason, message) => {
    authorizeEvent.mockResolvedValue({ ok: false, reason });
    await expect(deleteTaskAction(EVENT, TASK)).resolves.toEqual({ status: "error", message });
    expect(repository.deleteTask).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("uses the event authorization returned, not the one the caller sent", async () => {
    authorizeEvent.mockResolvedValue({ ok: true, event: { id: EVENT }, user: USER });
    await redirectedTo(() => deleteTaskAction(OTHER_EVENT, TASK));
    expect(repository.deleteTask).toHaveBeenCalledWith(expect.objectContaining({ eventId: EVENT }));
  });

  it("treats a malformed task ID as not found, without touching storage", async () => {
    await expect(deleteTaskAction(EVENT, "not-a-uuid")).resolves.toEqual({
      status: "error",
      message: TASK_MESSAGES.taskNotFound,
    });
    expect(repository.deleteTask).not.toHaveBeenCalled();
  });

  it("says the task no longer exists when it is not in this event", async () => {
    repository.deleteTask.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(deleteTaskAction(EVENT, TASK)).resolves.toEqual({
      status: "error",
      message: TASK_MESSAGES.taskNotFound,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("says nothing was removed when storage fails, without the error's own text", async () => {
    repository.deleteTask.mockRejectedValue(new Error("connection refused 10.0.0.5:5432"));
    const state = await deleteTaskAction(EVENT, TASK);
    expect(state).toEqual({ status: "error", message: TASK_MESSAGES.deleteFailed });
    expect(JSON.stringify(state)).not.toContain("10.0.0.5");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});