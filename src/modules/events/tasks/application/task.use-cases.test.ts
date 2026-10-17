// src/modules/events/tasks/application/task.use-cases.test.ts
// The task use cases against an in-memory repository (B6-F01, B6-F02; D-094): a create reaches
// storage as given, "nothing changed" writes nothing, a real change reaches storage with only the
// fields that changed, and a task outside the event is "not found".
import { describe, expect, it, vi } from "vitest";
import { createTask } from "./create-task";
import type { TaskRecord, TaskRepository } from "./ports";
import { updateTask } from "./update-task";

const EVENT = "e0000000-0000-4000-8000-000000000001";
const ACTOR = "a0000000-0000-4000-8000-000000000001";
const TASK = "10000000-0000-4000-8000-000000000001";
const version = new Date("2026-10-17T09:00:00.000Z");

const task: TaskRecord = {
  id: TASK,
  number: 4,
  title: "Confirm florist",
  description: "Call Ana",
  updatedAt: version,
};

function fakeRepository(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    listTasks: vi.fn(),
    findTask: vi.fn(async (_event, id) => (id === TASK ? task : null)),
    createTask: vi.fn(async () => ({ ok: true, id: TASK, number: 1 }) as const),
    updateTask: vi.fn(async () => ({ ok: true }) as const),
    ...overrides,
  } as TaskRepository;
}

describe("createTask", () => {
  it("passes the event, the actor and the validated input to storage", async () => {
    const repo = fakeRepository();
    const input = { title: "Print programs", description: null };
    await expect(createTask(repo, { eventId: EVENT, actorId: ACTOR, input })).resolves.toEqual({
      ok: true,
      id: TASK,
      number: 1,
    });
    expect(repo.createTask).toHaveBeenCalledWith({ eventId: EVENT, actorId: ACTOR, input });
  });

  it("passes a refusal through", async () => {
    const repo = fakeRepository({
      createTask: vi.fn(async () => ({ ok: false, reason: "not-found" }) as const),
    });
    const result = await createTask(repo, {
      eventId: EVENT,
      actorId: ACTOR,
      input: { title: "A", description: null },
    });
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("updateTask", () => {
  const args = { eventId: EVENT, taskId: TASK, actorId: ACTOR, version };

  it("reports unchanged and writes nothing when the values are the same", async () => {
    const repo = fakeRepository();
    const result = await updateTask(repo, {
      ...args,
      input: { title: "Confirm florist", description: "Call Ana" },
    });
    expect(result).toEqual({ ok: true, unchanged: true });
    expect(repo.updateTask).not.toHaveBeenCalled();
  });

  it("passes only the title when only the title changed", async () => {
    const repo = fakeRepository();
    await updateTask(repo, {
      ...args,
      input: { title: "Confirm both florists", description: "Call Ana" },
    });
    expect(repo.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: { title: { from: "Confirm florist", to: "Confirm both florists" } },
      }),
    );
  });

  it("records a description change as changed and never copies its text", async () => {
    const repo = fakeRepository();
    await updateTask(repo, {
      ...args,
      input: { title: "Confirm florist", description: "Call Ana at 0917 555 0101" },
    });
    const call = vi.mocked(repo.updateTask).mock.calls[0]![0];
    expect(call.changes).toEqual({ description: { changed: true } });
    expect(JSON.stringify(call.changes)).not.toContain("0917");
  });

  it("is not found for a task outside the event, and writes nothing", async () => {
    const repo = fakeRepository();
    const result = await updateTask(repo, {
      ...args,
      taskId: "10000000-0000-4000-8000-0000000000ff",
      input: { title: "A", description: null },
    });
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(repo.updateTask).not.toHaveBeenCalled();
  });

  it("passes a stale refusal through", async () => {
    const repo = fakeRepository({
      updateTask: vi.fn(async () => ({ ok: false, reason: "stale" }) as const),
    });
    const result = await updateTask(repo, { ...args, input: { title: "New", description: null } });
    expect(result).toEqual({ ok: false, reason: "stale" });
  });
});