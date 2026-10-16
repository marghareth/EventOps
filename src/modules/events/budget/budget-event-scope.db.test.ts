// src/modules/events/budget/budget-event-scope.db.test.ts
// Budget event isolation against PostgreSQL (B5-F10; D-002, D-084, D-085, D-091). Two events, each
// with a category and an item. Every repository operation tries the other event's records through
// this event's ID, the way a substituted ID would. Reads see only their own event; writes are
// refused and change nothing in either event (rows, item counter and Activity); the database's own
// composite foreign keys refuse a cross-event link even when the application is bypassed.
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
const { prismaBudgetRepository } = await import("./infrastructure/prisma-budget-repository");
const { summarizeEventBudget } = await import("./domain/budget-summary");
const { updateItem } = await import("./application/update-item");

const YEAR = 2081;
const userIds: string[] = [];

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
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

const itemInput = (categoryId: string, committed: string) => ({
  categoryId,
  name: "Deposit",
  estimated: "1000.00",
  committed,
  paid: "0.00",
  notes: null,
});

async function world() {
  const repository = prismaBudgetRepository(db);
  const ownerA = await newUser();
  const ownerB = await newUser();
  const viewerA = await newUser();
  const eventA = await newEvent(ownerA);
  const eventB = await newEvent(ownerB);
  await db.eventMember.create({
    data: { eventId: eventA, userId: viewerA, role: "VIEWER" as MemberRole },
  });
  const make = async (eventId: string, actorId: string, allocation: string, committed: string) => {
    const category = await repository.createCategory({
      eventId,
      actorId,
      input: { name: "Venue", allocation },
    });
    if (!category.ok) throw new Error("setup failed");
    const item = await repository.createItem({
      eventId,
      actorId,
      input: itemInput(category.id, committed),
    });
    if (!item.ok) throw new Error("setup failed");
    return { categoryId: category.id, itemId: item.id };
  };
  const a = await make(eventA, ownerA, "5000.00", "1000.00");
  const b = await make(eventB, ownerB, "9000.00", "9500.00");
  return { repository, ownerA, ownerB, viewerA, eventA, eventB, a, b };
}

/** Everything a budget operation could change, in either event. */
async function snapshot(eventA: string, eventB: string) {
  const where = { eventId: { in: [eventA, eventB] } };
  return {
    categories: await db.budgetCategory.findMany({ where, orderBy: { id: "asc" } }),
    items: await db.budgetItem.findMany({ where, orderBy: { id: "asc" } }),
    counters: await db.event.findMany({
      where: { id: { in: [eventA, eventB] } },
      select: { id: true, lastBudgetItemNumber: true },
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

describe("budget reads are scoped to one event", () => {
  it("lists only this event's categories and items", async () => {
    const w = await world();
    const listed = await w.repository.listBudget(w.eventA);
    expect(listed.map((category) => category.id)).toEqual([w.a.categoryId]);
    expect(listed[0]?.items.map((item) => item.id)).toEqual([w.a.itemId]);
  });

  it("finds a record only inside its own event", async () => {
    const w = await world();
    expect(await w.repository.findCategory(w.eventA, w.a.categoryId)).not.toBeNull();
    expect(await w.repository.findCategory(w.eventA, w.b.categoryId)).toBeNull();
    expect(await w.repository.findItem(w.eventA, w.a.itemId)).not.toBeNull();
    expect(await w.repository.findItem(w.eventA, w.b.itemId)).toBeNull();
  });

  it("builds each event's summary from its own records only", async () => {
    const w = await world();
    const a = summarizeEventBudget(await w.repository.listBudget(w.eventA));
    const b = summarizeEventBudget(await w.repository.listBudget(w.eventB));
    expect(a.event).toMatchObject({
      allocated: "5000.00",
      committed: "1000.00",
      status: "WITHIN_BUDGET",
    });
    expect(b.event).toMatchObject({
      allocated: "9000.00",
      committed: "9500.00",
      status: "OVER_BUDGET",
    });
  });
});

describe("budget writes cannot reach another event", () => {
  it("refuses to change, delete or add to the other event's records, and changes nothing", async () => {
    const w = await world();
    const before = await snapshot(w.eventA, w.eventB);
    const version = (await db.budgetCategory.findUniqueOrThrow({ where: { id: w.b.categoryId } }))
      .updatedAt;
    const itemVersion = (await db.budgetItem.findUniqueOrThrow({ where: { id: w.b.itemId } }))
      .updatedAt;

    expect(
      await w.repository.updateCategory({
        eventId: w.eventA,
        actorId: w.ownerA,
        categoryId: w.b.categoryId,
        version,
        input: { name: "Hijacked", allocation: "1.00" },
        changes: {},
      }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(
      await w.repository.deleteCategory({
        eventId: w.eventA,
        actorId: w.ownerA,
        categoryId: w.b.categoryId,
      }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(
      await w.repository.updateItem({
        eventId: w.eventA,
        actorId: w.ownerA,
        itemId: w.b.itemId,
        version: itemVersion,
        input: itemInput(w.a.categoryId, "1.00"),
        changes: {},
      }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(
      await w.repository.deleteItem({ eventId: w.eventA, actorId: w.ownerA, itemId: w.b.itemId }),
    ).toEqual({ ok: false, reason: "not-found" });
    // A new item in Event A must not land in Event B's category, and must not use up a number.
    expect(
      await w.repository.createItem({
        eventId: w.eventA,
        actorId: w.ownerA,
        input: itemInput(w.b.categoryId, "1.00"),
      }),
    ).toEqual({ ok: false, reason: "not-found" });

    expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
  });

  it("refuses a move to the other event's category, in the use case and in the database", async () => {
    const w = await world();
    const before = await snapshot(w.eventA, w.eventB);
    const item = await db.budgetItem.findUniqueOrThrow({ where: { id: w.a.itemId } });

    // The use case checks the target category inside the event.
    expect(
      await updateItem(w.repository, {
        eventId: w.eventA,
        itemId: w.a.itemId,
        actorId: w.ownerA,
        version: item.updatedAt,
        input: itemInput(w.b.categoryId, "1000.00"),
      }),
    ).toEqual({ ok: false, reason: "not-found" });

    // Bypassing the use case, the composite foreign key refuses it.
    await expect(
      w.repository.updateItem({
        eventId: w.eventA,
        actorId: w.ownerA,
        itemId: w.a.itemId,
        version: item.updatedAt,
        input: itemInput(w.b.categoryId, "1000.00"),
        changes: {},
      }),
    ).rejects.toThrow();
    // Bypassing the repository too, a direct insert is refused.
    await expect(
      db.budgetItem.create({
        data: {
          eventId: w.eventA,
          categoryId: w.b.categoryId,
          number: 99,
          name: "Smuggled",
          estimatedAmount: "1.00",
          committedAmount: "1.00",
          paidAmount: "0.00",
        },
      }),
    ).rejects.toThrow();

    expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
  });

  it("refuses an actor who is not a member of the event, or only a viewer", async () => {
    const w = await world();
    const before = await snapshot(w.eventA, w.eventB);
    for (const actorId of [w.ownerB, w.viewerA]) {
      expect(
        await w.repository.createCategory({
          eventId: w.eventA,
          actorId,
          input: { name: "Music", allocation: "100.00" },
        }),
      ).toEqual({ ok: false, reason: "not-found" });
      expect(
        await w.repository.createItem({
          eventId: w.eventA,
          actorId,
          input: itemInput(w.a.categoryId, "1.00"),
        }),
      ).toEqual({ ok: false, reason: "not-found" });
      expect(
        await w.repository.deleteItem({ eventId: w.eventA, actorId, itemId: w.a.itemId }),
      ).toEqual({ ok: false, reason: "not-found" });
    }
    expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
  });

  it("numbers items per event, so one event's additions never move the other's counter", async () => {
    const w = await world();
    const counterB = (await db.event.findUniqueOrThrow({ where: { id: w.eventB } }))
      .lastBudgetItemNumber;
    const added = await w.repository.createItem({
      eventId: w.eventA,
      actorId: w.ownerA,
      input: itemInput(w.a.categoryId, "1.00"),
    });
    expect(added).toMatchObject({ ok: true, number: 2 });
    expect(
      (await db.event.findUniqueOrThrow({ where: { id: w.eventB } })).lastBudgetItemNumber,
    ).toBe(counterB);
  });

  it("deletes a whole event's budget with the event and leaves the other event alone", async () => {
    const w = await world();
    await db.event.delete({ where: { id: w.eventA } });
    expect(await db.budgetCategory.count({ where: { eventId: w.eventA } })).toBe(0);
    expect(await db.budgetItem.count({ where: { eventId: w.eventA } })).toBe(0);
    expect(await db.budgetItem.count({ where: { eventId: w.eventB } })).toBe(1);
  });
});