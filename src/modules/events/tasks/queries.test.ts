// src/modules/events/tasks/queries.test.ts
// Event scoping of the task reads (B6-F01, B6-F02; D-094). With authorization and storage replaced,
// this checks that every read uses the event ID that authorizeEvent returned, never the one the
// caller sent; refuses before touching storage; and treats a malformed or foreign task ID as "not
// found".
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const EVENT_A = "e0000000-0000-4000-8000-00000000000a";
const SENT = "E0000000-0000-4000-8000-00000000000A"; // same event, as the caller wrote it
const TASK_B = "10000000-0000-4000-8000-00000000000b";

const authorizeEvent = vi.fn();
vi.mock("@/modules/events/public", () => ({
  authorizeEvent: (...args: unknown[]) => authorizeEvent(...args),
}));

const repository = {
  listTasks: vi.fn(async () => []),
  findTask: vi.fn(async () => null),
};
vi.mock("./composition", () => ({ taskRepository: () => repository }));

const { getEventTasks, getTaskForEdit } = await import("./queries");

const ok = { ok: true, event: { id: EVENT_A }, user: { id: "u1" } };

beforeEach(() => {
  vi.clearAllMocks();
  authorizeEvent.mockResolvedValue(ok);
});

describe("getEventTasks", () => {
  it("lists the authorized event's tasks, using the ID authorization returned", async () => {
    await getEventTasks(SENT);
    expect(repository.listTasks).toHaveBeenCalledWith(EVENT_A);
  });

  it("lets a Viewer read, without write controls", async () => {
    authorizeEvent.mockImplementation(async (_event: string, permission: string) =>
      permission === "event.view" ? ok : { ok: false, reason: "forbidden" },
    );
    await expect(getEventTasks(SENT)).resolves.toMatchObject({ ok: true, canManage: false });
  });

  it("gives an Owner or Coordinator the write controls", async () => {
    await expect(getEventTasks(SENT)).resolves.toMatchObject({ ok: true, canManage: true });
  });

  it("refuses before touching storage", async () => {
    authorizeEvent.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(getEventTasks(SENT)).resolves.toEqual({ ok: false, reason: "not-found" });
    expect(repository.listTasks).not.toHaveBeenCalled();
  });
});

describe("getTaskForEdit", () => {
  it("needs tasks.manage, so a Viewer is refused before storage", async () => {
    authorizeEvent.mockResolvedValue({ ok: false, reason: "forbidden" });
    await expect(getTaskForEdit(SENT, TASK_B)).resolves.toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(authorizeEvent).toHaveBeenCalledWith(SENT, "tasks.manage", expect.any(String));
    expect(repository.findTask).not.toHaveBeenCalled();
  });

  it("looks the task up inside the authorized event only", async () => {
    await getTaskForEdit(SENT, TASK_B);
    expect(repository.findTask).toHaveBeenCalledWith(EVENT_A, TASK_B);
  });

  it("is not found for a task outside the event", async () => {
    await expect(getTaskForEdit(SENT, TASK_B)).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("is not found for a malformed task ID, without a lookup", async () => {
    await expect(getTaskForEdit(SENT, "not-a-uuid")).resolves.toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(repository.findTask).not.toHaveBeenCalled();
  });
});