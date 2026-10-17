// src/modules/events/tasks/application/task.use-cases.test.ts
// The task use cases against an in-memory repository (B6-F01 to B6-F05; D-094, D-095): a create
// reaches storage as given, "nothing changed" writes nothing, a real change reaches storage with
// only the fields that changed, an assignee from another event is refused, and a task outside the
// event is "not found".
import { describe, expect, it, vi } from "vitest";
import { createTask } from "./create-task";
import { deleteTask } from "./delete-task";
import type { AssignableMember, TaskRecord, TaskRepository } from "./ports";
import { updateTask } from "./update-task";

const EVENT = "e0000000-0000-4000-8000-000000000001";
const ACTOR = "a0000000-0000-4000-8000-000000000001";
const TASK = "10000000-0000-4000-8000-000000000001";
const ANA = "b0000000-0000-4000-8000-00000000000a";
const BEN = "b0000000-0000-4000-8000-00000000000b";
const OTHER_EVENT_MEMBER = "b0000000-0000-4000-8000-0000000000ff";
const version = new Date("2026-10-17T09:00:00.000Z");

const task: TaskRecord = {
  id: TASK,
  number: 4,
  title: "Confirm florist",
  description: "Call Ana",
  priority: "MEDIUM",
  assignee: null,
  updatedAt: version,
};
const members: AssignableMember[] = [
  { id: ANA, name: "Ana Reyes", role: "COORDINATOR" },
  { id: BEN, name: "Ben Cruz", role: "VIEWER" },
];

function fakeRepository(
  overrides: Partial<TaskRepository> = {},
  record: TaskRecord = task,
): TaskRepository {
  return {
    listTasks: vi.fn(),
    listAssignableMembers: vi.fn(async () => members),
    findTask: vi.fn(async (_event, id) => (id === TASK ? record : null)),
    // Only this event's members are found: another event's member ID is not.
    findAssignableMember: vi.fn(async (_event, id) => members.find((m) => m.id === id) ?? null),
    createTask: vi.fn(async () => ({ ok: true, id: TASK, number: 1 }) as const),
    updateTask: vi.fn(async () => ({ ok: true }) as const),
    deleteTask: vi.fn(async () => ({ ok: true, number: 4, title: "Confirm florist" }) as const),
    ...overrides,
  } as TaskRepository;
}

const same = {
  title: "Confirm florist",
  description: "Call Ana",
  priority: "MEDIUM" as const,
  assigneeId: null,
};

describe("createTask", () => {
  it("passes the event, the actor and the validated input to storage", async () => {
    const repo = fakeRepository();
    const input = {
      title: "Print programs",
      description: null,
      priority: "HIGH" as const,
      assigneeId: ANA,
    };
    await expect(createTask(repo, { eventId: EVENT, actorId: ACTOR, input })).resolves.toEqual({
      ok: true,
      id: TASK,
      number: 1,
    });
    expect(repo.createTask).toHaveBeenCalledWith({ eventId: EVENT, actorId: ACTOR, input });
  });

  it("passes a refusal through, including an assignee outside the event", async () => {
    for (const reason of ["not-found", "assignee-not-found"] as const) {
      const repo = fakeRepository({
        createTask: vi.fn(async () => ({ ok: false, reason }) as const),
      });
      const result = await createTask(repo, {
        eventId: EVENT,
        actorId: ACTOR,
        input: {
          title: "A",
          description: null,
          priority: "MEDIUM",
          assigneeId: OTHER_EVENT_MEMBER,
        },
      });
      expect(result).toEqual({ ok: false, reason });
    }
  });
});

describe("updateTask", () => {
  const args = { eventId: EVENT, taskId: TASK, actorId: ACTOR, version };

  it("reports unchanged and writes nothing when the values are the same", async () => {
    const repo = fakeRepository();
    const result = await updateTask(repo, { ...args, input: same });
    expect(result).toEqual({ ok: true, unchanged: true });
    expect(repo.updateTask).not.toHaveBeenCalled();
  });

  it("passes only the title when only the title changed", async () => {
    const repo = fakeRepository();
    await updateTask(repo, { ...args, input: { ...same, title: "Confirm both florists" } });
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
      input: { ...same, description: "Call Ana at 0917 555 0101" },
    });
    const call = vi.mocked(repo.updateTask).mock.calls[0]![0];
    expect(call.changes).toEqual({ description: { changed: true } });
    expect(JSON.stringify(call.changes)).not.toContain("0917");
  });

  it("records a priority change old → new (B6-F05)", async () => {
    const repo = fakeRepository();
    await updateTask(repo, { ...args, input: { ...same, priority: "HIGH" } });
    expect(repo.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ changes: { priority: { from: "MEDIUM", to: "HIGH" } } }),
    );
  });

  it("assigns a member of the event and records their name (B6-F04)", async () => {
    const repo = fakeRepository();
    await updateTask(repo, { ...args, input: { ...same, assigneeId: ANA } });
    expect(repo.findAssignableMember).toHaveBeenCalledWith(EVENT, ANA);
    expect(repo.updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ changes: { assignee: { from: null, to: "Ana Reyes" } } }),
    );
  });

  it("reassigns and unassigns, recording old → new", async () => {
    const assigned = { ...task, assignee: { id: ANA, name: "Ana Reyes" } };
    const repo = fakeRepository({}, assigned);
    await updateTask(repo, { ...args, input: { ...same, assigneeId: BEN } });
    expect(repo.updateTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ changes: { assignee: { from: "Ana Reyes", to: "Ben Cruz" } } }),
    );
    await updateTask(repo, { ...args, input: { ...same, assigneeId: null } });
    expect(repo.updateTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ changes: { assignee: { from: "Ana Reyes", to: null } } }),
    );
  });

  it("keeps the current assignee without a lookup and writes nothing when nothing else changed", async () => {
    const repo = fakeRepository({}, { ...task, assignee: { id: ANA, name: "Ana Reyes" } });
    const result = await updateTask(repo, { ...args, input: { ...same, assigneeId: ANA } });
    expect(result).toEqual({ ok: true, unchanged: true });
    expect(repo.findAssignableMember).not.toHaveBeenCalled();
    expect(repo.updateTask).not.toHaveBeenCalled();
  });

  it("refuses an assignee who is not a member of this event, and writes nothing", async () => {
    const repo = fakeRepository();
    const result = await updateTask(repo, {
      ...args,
      input: { ...same, assigneeId: OTHER_EVENT_MEMBER },
    });
    expect(result).toEqual({ ok: false, reason: "assignee-not-found" });
    expect(repo.findAssignableMember).toHaveBeenCalledWith(EVENT, OTHER_EVENT_MEMBER);
    expect(repo.updateTask).not.toHaveBeenCalled();
  });

  it("is not found for a task outside the event, and writes nothing", async () => {
    const repo = fakeRepository();
    const result = await updateTask(repo, {
      ...args,
      taskId: "10000000-0000-4000-8000-0000000000ff",
      input: same,
    });
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(repo.updateTask).not.toHaveBeenCalled();
  });

  it("passes a stale refusal through", async () => {
    const repo = fakeRepository({
      updateTask: vi.fn(async () => ({ ok: false, reason: "stale" }) as const),
    });
    const result = await updateTask(repo, { ...args, input: { ...same, title: "New" } });
    expect(result).toEqual({ ok: false, reason: "stale" });
  });
});

describe("deleteTask (B6-F03)", () => {
  const args = { eventId: EVENT, taskId: TASK, actorId: ACTOR };

  it("passes the event, the task and the actor to storage and returns what was removed", async () => {
    const repo = fakeRepository();
    await expect(deleteTask(repo, args)).resolves.toEqual({
      ok: true,
      number: 4,
      title: "Confirm florist",
    });
    expect(repo.deleteTask).toHaveBeenCalledWith(args);
  });

  it("passes a not-found refusal through", async () => {
    const repo = fakeRepository({
      deleteTask: vi.fn(async () => ({ ok: false, reason: "not-found" }) as const),
    });
    await expect(deleteTask(repo, args)).resolves.toEqual({ ok: false, reason: "not-found" });
  });
});