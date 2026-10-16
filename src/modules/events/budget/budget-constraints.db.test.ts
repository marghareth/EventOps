// src/modules/events/budget/budget-constraints.db.test.ts
// The database refuses invalid budget rows even when the application is bypassed (B5-F12; D-084,
// D-085, D-002). Each case inserts or updates a row directly. The CHECK constraints, the
// case-insensitive unique name, the unique item number and the composite foreign keys are the last
// line behind the Zod schemas.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

let db: PrismaClient;

const { createEvent } = await import("../create-event");

const YEAR = 2083;
const userIds: string[] = [];

async function setup() {
  const userId = randomUUID();
  userIds.push(userId);
  await db.user.create({
    data: { id: userId, email: `${userId}@example.test`, displayName: "Mika" },
  });
  const { id: eventId } = await createEvent(db, {
    event: {
      name: "Santos wedding",
      venue: null,
      description: null,
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      endsAt: null,
      capacity: null,
      expectedAttendees: 0,
    },
    creatorId: userId,
    now: new Date(`${YEAR}-01-01`),
  });
  const category = await db.budgetCategory.create({
    data: { eventId, name: "Venue", allocationAmount: "1000.00" },
  });
  const item = await db.budgetItem.create({
    data: {
      eventId,
      categoryId: category.id,
      number: 1,
      name: "Deposit",
      estimatedAmount: "100.00",
      committedAmount: "0.00",
      paidAmount: "0.00",
    },
  });
  return { eventId, categoryId: category.id, itemId: item.id };
}

const itemData = (
  s: { eventId: string; categoryId: string },
  over: Record<string, unknown> = {},
) => ({
  eventId: s.eventId,
  categoryId: s.categoryId,
  number: 2,
  name: "Flowers",
  estimatedAmount: "100.00",
  committedAmount: "0.00",
  paidAmount: "0.00",
  ...over,
});

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

describe("budget categories", () => {
  it("refuses a negative allocation and a blank name", async () => {
    const s = await setup();
    await expect(
      db.budgetCategory.create({
        data: { eventId: s.eventId, name: "Neg", allocationAmount: "-0.01" },
      }),
    ).rejects.toThrow();
    await expect(
      db.budgetCategory.create({
        data: { eventId: s.eventId, name: "   ", allocationAmount: "1.00" },
      }),
    ).rejects.toThrow();
  });

  it("refuses a second category whose name differs only by letter case", async () => {
    const s = await setup();
    await expect(
      db.budgetCategory.create({
        data: { eventId: s.eventId, name: "VENUE", allocationAmount: "1.00" },
      }),
    ).rejects.toThrow();
  });

  it("allows the same name in another event", async () => {
    const a = await setup();
    const b = await setup();
    expect(a.eventId).not.toBe(b.eventId);
  });

  it("refuses an allocation above the column maximum", async () => {
    const s = await setup();
    await expect(
      db.budgetCategory.create({
        data: { eventId: s.eventId, name: "Big", allocationAmount: "10000000000.00" },
      }),
    ).rejects.toThrow();
  });
});

describe("budget items", () => {
  it.each(["estimatedAmount", "committedAmount", "paidAmount"])(
    "refuses a negative %s",
    async (field) => {
      const s = await setup();
      await expect(
        db.budgetItem.create({ data: itemData(s, { [field]: "-0.01" }) }),
      ).rejects.toThrow();
    },
  );

  it("refuses a blank name, blank notes and an item number below 1", async () => {
    const s = await setup();
    await expect(db.budgetItem.create({ data: itemData(s, { name: " " }) })).rejects.toThrow();
    await expect(db.budgetItem.create({ data: itemData(s, { notes: "  " }) })).rejects.toThrow();
    await expect(db.budgetItem.create({ data: itemData(s, { number: 0 }) })).rejects.toThrow();
  });

  it("refuses a repeated item number within one event", async () => {
    const s = await setup();
    await expect(db.budgetItem.create({ data: itemData(s, { number: 1 }) })).rejects.toThrow();
  });

  it("refuses an item whose category does not exist in its event", async () => {
    const s = await setup();
    await expect(
      db.budgetItem.create({ data: itemData(s, { categoryId: randomUUID() }) }),
    ).rejects.toThrow();
  });

  it("refuses to delete a category that still has items", async () => {
    const s = await setup();
    await expect(db.budgetCategory.delete({ where: { id: s.categoryId } })).rejects.toThrow();
  });

  it("refuses an update that would make an amount negative", async () => {
    const s = await setup();
    await expect(
      db.budgetItem.update({ where: { id: s.itemId }, data: { paidAmount: "-1.00" } }),
    ).rejects.toThrow();
  });
});