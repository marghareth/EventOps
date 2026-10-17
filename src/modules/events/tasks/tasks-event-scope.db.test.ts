// src/modules/events/tasks/tasks-event-scope.db.test.ts
// Task isolation, assignment and deletion against PostgreSQL (B6-F03, B6-F04, B6-F05; D-002, D-094,
// D-095). Two events, each with a task. Every repository operation tries the other event's records
// through this event's ID, the way a substituted ID would: reads see only their own event, writes
// are refused and change nothing in either event (rows, task counter and Activity). The database's
// composite foreign key refuses an assignee from another event even when the application is
// bypassed, and removing a member leaves their tasks in place, unassigned.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type MemberRole } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

let db: PrismaClient;

const { createEvent } = await import("../create-event");
const { prismaTaskRepository } = await import("./infrastructure/prisma-task-repository");
const { updateTask } = await import("./application/update-task");

const YEAR = 2082;
const userIds: string[] = [];

async function newUser(displayName = "Mika") {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName } });
  return id;
}

async function newEvent(ownerId: string) {
  const { id } = await createEvent(db, {
    event: {
      name: "Santos wedding",
      venue: null,
      description: null,
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      endsAt: null,
      capacity: null,
      expectedAttendees: 0,
    },
    creatorId: ownerId,
    now: new Date(`${YEAR}-01-01`),
  });
  return id;
}

async function addMember(eventId: string, userId: string, role: MemberRole) {
  return db.eventMember.create({ data: { eventId, userId, role }, select: { id: true } });
}

const input = (
  title: string,
  extra: { priority?: "HIGH" | "MEDIUM" | "LOW"; assigneeId?: string | null } = {},
) => ({
  title,
  description: null,
  priority: extra.priority ?? ("MEDIUM" as const),
  assigneeId: extra.assigneeId ?? null,
});

async function world() {
  const repository = prismaTaskRepository(db);
  const ownerA = await newUser("Mika");
  const ownerB = await newUser("Bea");
  const viewerA = await newUser("Vic");
  const coordinatorA = await newUser("Ana");
  const eventA = await newEvent(ownerA);
  const eventB = await newEvent(ownerB);
  await addMember(eventA, viewerA, "VIEWER");
  const ana = await addMember(eventA, coordinatorA, "COORDINATOR");
  const ownerMemberB = await db.eventMember.findFirstOrThrow({
    where: { eventId: eventB, userId: ownerB },
    select: { id: true },
  });
  const a = await repository.createTask({
    eventId: eventA,
    actorId: ownerA,
    input: input("Task A"),
  });
  const b = await repository.createTask({
    eventId: eventB,
    actorId: ownerB,
    input: input("Task B"),
  });
  if (!a.ok || !b.ok) throw new Error("setup failed");
  return {
    repository,
    ownerA,
    ownerB,
    viewerA,
    coordinatorA,
    eventA,
    eventB,
    ana,
    ownerMemberB,
    a,
    b,
  };
}

/** Everything a task operation could change, in either event. */
async function snapshot(eventA: string, eventB: string) {
  const where = { eventId: { in: [eventA, eventB] } };
  return {
    tasks: await db.task.findMany({ where, orderBy: { id: "asc" } }),
    counters: await db.event.findMany({
      where: { id: { in: [eventA, eventB] } },
      select: { id: true, lastTaskNumber: true },
      orderBy: { id: "asc" },
    }),
    audit: await db.auditLog.count({ where }),
  };
}

beforeAll(() => {
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
});
afterEach(async () => {
  await db.event.deleteMany({ where: { createdById: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  await db.eventReferenceCounter.deleteMany({ where: { year: YEAR } });
});
afterAll(async () => {
  await db.$disconnect();
});

describe("task reads are scoped to one event", () => {
  it("lists only this event's tasks, and finds a task only inside its own event", async () => {
    const w = await world();
    expect((await w.repository.listTasks(w.eventA)).map((task) => task.id)).toEqual([w.a.id]);
    expect(await w.repository.findTask(w.eventA, w.a.id)).not.toBeNull();
    expect(await w.repository.findTask(w.eventA, w.b.id)).toBeNull();
  });

  it("lists only this event's members as assignees, and finds one only inside its event", async () => {
    const w = await world();
    const names = (await w.repository.listAssignableMembers(w.eventA)).map((m) => m.name);
    expect(names).toEqual(["Ana", "Mika", "Vic"]);
    expect(await w.repository.findAssignableMember(w.eventA, w.ana.id)).toMatchObject({
      name: "Ana",
    });
    expect(await w.repository.findAssignableMember(w.eventA, w.ownerMemberB.id)).toBeNull();
  });
});

describe("task writes are scoped to one event and one role", () => {
  it("deleting another event's task through this event's ID removes nothing", async () => {
    const w = await world();
    const before = await snapshot(w.eventA, w.eventB);
    const result = await w.repository.deleteTask({
      eventId: w.eventA,
      taskId: w.b.id,
      actorId: w.ownerA,
    });
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
  });

  it("a member of another event cannot delete this event's task", async () => {
    const w = await world();
    const before = await snapshot(w.eventA, w.eventB);
    const result = await w.repository.deleteTask({
      eventId: w.eventA,
      taskId: w.a.id,
      actorId: w.ownerB,
    });
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
  });

  it("a Viewer cannot create, edit or delete a task, and nothing changes", async () => {
    const w = await world();
    const before = await snapshot(w.eventA, w.eventB);
    expect(
      await w.repository.createTask({
        eventId: w.eventA,
        actorId: w.viewerA,
        input: input("Nope"),
      }),
    ).toEqual({ ok: false, reason: "not-found" });
    const current = await w.repository.findTask(w.eventA, w.a.id);
    expect(
      await w.repository.updateTask({
        eventId: w.eventA,
        taskId: w.a.id,
        actorId: w.viewerA,
        version: current!.updatedAt,
        input: input("Changed", { priority: "HIGH" }),
        changes: { title: { from: "Task A", to: "Changed" } },
      }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(
      await w.repository.deleteTask({ eventId: w.eventA, taskId: w.a.id, actorId: w.viewerA }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
  });

  it("deletes a task for a Coordinator, records the deletion, and never reuses the number", async () => {
    const w = await world();
    const result = await w.repository.deleteTask({
      eventId: w.eventA,
      taskId: w.a.id,
      actorId: w.coordinatorA,
    });
    expect(result).toEqual({ ok: true, number: 1, title: "Task A" });
    expect(await w.repository.findTask(w.eventA, w.a.id)).toBeNull();
    // The other event's task is untouched.
    expect(await w.repository.findTask(w.eventB, w.b.id)).not.toBeNull();
    const entry = await db.auditLog.findFirstOrThrow({
      where: { eventId: w.eventA, action: "task.deleted" },
    });
    expect(entry.actorId).toBe(w.coordinatorA);
    expect(entry.details).toEqual({ reference: "TSK-0001", title: "Task A" });
    const next = await w.repository.createTask({
      eventId: w.eventA,
      actorId: w.ownerA,
      input: input("Next"),
    });
    expect(next).toMatchObject({ ok: true, number: 2 });
  });
});

describe("priority (B6-F05)", () => {
  it("stores the chosen priority and records it on creation", async () => {
    const w = await world();
    const created = await w.repository.createTask({
      eventId: w.eventA,
      actorId: w.ownerA,
      input: input("Urgent", { priority: "HIGH" }),
    });
    if (!created.ok) throw new Error("setup failed");
    expect((await w.repository.findTask(w.eventA, created.id))?.priority).toBe("HIGH");
    const entry = await db.auditLog.findFirstOrThrow({
      where: { eventId: w.eventA, entityId: created.id, action: "task.created" },
    });
    expect(entry.details).toMatchObject({
      reference: "TSK-0002",
      priority: "HIGH",
      assignee: null,
    });
  });
});

describe("assignment (B6-F04)", () => {
  it("creates a task assigned to a member of the event, recording their name", async () => {
    const w = await world();
    const created = await w.repository.createTask({
      eventId: w.eventA,
      actorId: w.ownerA,
      input: input("Call florist", { assigneeId: w.ana.id }),
    });
    if (!created.ok) throw new Error("setup failed");
    expect((await w.repository.findTask(w.eventA, created.id))?.assignee).toEqual({
      id: w.ana.id,
      name: "Ana",
    });
    const entry = await db.auditLog.findFirstOrThrow({
      where: { eventId: w.eventA, entityId: created.id, action: "task.created" },
    });
    expect(entry.details).toMatchObject({ assignee: "Ana" });
  });

  it("refuses an assignee from another event when creating, without using up a number", async () => {
    const w = await world();
    const before = await snapshot(w.eventA, w.eventB);
    const result = await w.repository.createTask({
      eventId: w.eventA,
      actorId: w.ownerA,
      input: input("Nope", { assigneeId: w.ownerMemberB.id }),
    });
    expect(result).toEqual({ ok: false, reason: "assignee-not-found" });
    expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
  });

  it("assigns, reassigns and unassigns through the use case, with one entry per change", async () => {
    const w = await world();
    const run = async (assigneeId: string | null, priority: "HIGH" | "MEDIUM" = "MEDIUM") => {
      const current = await w.repository.findTask(w.eventA, w.a.id);
      return updateTask(w.repository, {
        eventId: w.eventA,
        taskId: w.a.id,
        actorId: w.ownerA,
        version: current!.updatedAt,
        input: input("Task A", { assigneeId, priority }),
      });
    };
    expect(await run(w.ana.id)).toEqual({ ok: true });
    expect((await w.repository.findTask(w.eventA, w.a.id))?.assignee?.name).toBe("Ana");
    expect(await run(w.ana.id)).toEqual({ ok: true, unchanged: true });
    expect(await run(w.ana.id, "HIGH")).toEqual({ ok: true });
    expect(await run(null, "HIGH")).toEqual({ ok: true });
    expect((await w.repository.findTask(w.eventA, w.a.id))?.assignee).toBeNull();

    const entries = await db.auditLog.findMany({
      where: { eventId: w.eventA, entityId: w.a.id, action: "task.updated" },
      orderBy: { createdAt: "asc" },
    });
    expect(entries.map((e) => (e.details as { changes: unknown }).changes)).toEqual([
      { assignee: { from: null, to: "Ana" } },
      { priority: { from: "MEDIUM", to: "HIGH" } },
      { assignee: { from: "Ana", to: null } },
    ]);
  });

  it("refuses an assignee from another event on edit, and changes nothing", async () => {
    const w = await world();
    const before = await snapshot(w.eventA, w.eventB);
    const current = await w.repository.findTask(w.eventA, w.a.id);
    const result = await updateTask(w.repository, {
      eventId: w.eventA,
      taskId: w.a.id,
      actorId: w.ownerA,
      version: current!.updatedAt,
      input: input("Task A", { assigneeId: w.ownerMemberB.id }),
    });
    expect(result).toEqual({ ok: false, reason: "assignee-not-found" });
    expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
  });

  it("refuses a stale save", async () => {
    const w = await world();
    const stale = (await w.repository.findTask(w.eventA, w.a.id))!.updatedAt;
    await w.repository.updateTask({
      eventId: w.eventA,
      taskId: w.a.id,
      actorId: w.ownerA,
      version: stale,
      input: input("Task A", { priority: "HIGH" }),
      changes: { priority: { from: "MEDIUM", to: "HIGH" } },
    });
    const result = await w.repository.updateTask({
      eventId: w.eventA,
      taskId: w.a.id,
      actorId: w.ownerA,
      version: stale,
      input: input("Task A", { priority: "LOW" }),
      changes: { priority: { from: "HIGH", to: "LOW" } },
    });
    expect(result).toEqual({ ok: false, reason: "stale" });
  });

  it("the database itself refuses a member of another event, even with the application bypassed", async () => {
    const w = await world();
    await expect(
      db.task.update({ where: { id: w.a.id }, data: { assigneeId: w.ownerMemberB.id } }),
    ).rejects.toThrow(/tasks_eventId_assigneeId_fkey|Foreign key/i);
  });

  it("removing the member keeps the task, unassigned, with a newer edit version", async () => {
    const w = await world();
    await db.task.update({ where: { id: w.a.id }, data: { assigneeId: w.ana.id } });
    const before = (await w.repository.findTask(w.eventA, w.a.id))!;
    await db.eventMember.delete({ where: { id: w.ana.id } });
    const after = await w.repository.findTask(w.eventA, w.a.id);
    expect(after).toMatchObject({ title: "Task A", assignee: null });
    expect(after!.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
  });

  it("removing a user removes their membership and unassigns their tasks", async () => {
    const w = await world();
    await db.task.update({ where: { id: w.a.id }, data: { assigneeId: w.ana.id } });
    await db.user.delete({ where: { id: w.coordinatorA } });
    expect((await w.repository.findTask(w.eventA, w.a.id))?.assignee).toBeNull();
  });

  it("deleting an event removes its tasks even when they are assigned", async () => {
    const w = await world();
    await db.task.update({ where: { id: w.a.id }, data: { assigneeId: w.ana.id } });
    await db.event.delete({ where: { id: w.eventA } });
    expect(await db.task.count({ where: { eventId: w.eventA } })).toBe(0);
    expect(await db.task.count({ where: { eventId: w.eventB } })).toBe(1);
  });
});