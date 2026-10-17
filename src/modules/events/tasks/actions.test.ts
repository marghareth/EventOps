// src/modules/events/tasks/actions.test.ts
// @vitest-environment node
// Task server actions (B6-F01, B6-F02; D-035, D-036, D-094) with authorization, storage and Next.js
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
};
vi.mock("./composition", () => ({ taskRepository: () => repository }));

const { createTaskAction, updateTaskAction } = await import("./actions");

const EVENT = "e0000000-0000-4000-8000-00000000000a";
const OTHER_EVENT = "e0000000-0000-4000-8000-00000000000b";
const TASK = "10000000-0000-4000-8000-00000000000a";
const VERSION = "2026-10-17T00:00:00.000Z";
const USER = { id: "u0000000-0000-4000-8000-00000000000a", email: "mika@example.test" };
const idle = { status: "idle" } as const;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const fields = { title: "Confirm florist", description: "Call Ana" };
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
    updatedAt: new Date(VERSION),
  });
  repository.createTask.mockResolvedValue({ ok: true, id: TASK, number: 7 });
  repository.updateTask.mockResolvedValue({ ok: true });
});

describe("createTaskAction", () => {
  it("authorizes tasks.manage for the bound event, then adds the task and opens the list", async () => {
    const url = await redirectedTo(() => createTaskAction(EVENT, idle, form(fields)));
    expect(authorizeEvent).toHaveBeenCalledWith(EVENT, "tasks.manage", `/events/${EVENT}/tasks`);
    expect(repository.createTask).toHaveBeenCalledWith({
      eventId: EVENT,
      actorId: USER.id,
      input: { title: "Confirm florist", description: "Call Ana" },
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
      form({ title: "   ", description: "x".repeat(2001) }),
    );
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: {
        title: "Enter a task title.",
        description: "Keep the description to 2000 characters or fewer.",
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
      input: { title: "Confirm both florists", description: "Call Ana" },
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