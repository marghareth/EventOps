// src/modules/events/create-event.db.test.ts
// Database tests for the create-event use case (B1-02). Run with `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db";
import { createEvent } from "./create-event";
import type { NewEvent } from "./schema";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

// A year no other test uses, so reference numbers are predictable.
const YEAR = 2091;
const NOW = new Date(`${YEAR}-06-01T00:00:00Z`);

let db: PrismaClient;
const userIds: string[] = [];

const event: NewEvent = {
  name: "Santos wedding",
  venue: "Cebu",
  description: null,
  startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
  endsAt: null,
  capacity: 200,
  expectedAttendees: 180,
};

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
  return id;
}

beforeAll(() => {
  db = createPrismaClient(url);
});
afterEach(async () => {
  await db.event.deleteMany({ where: { createdById: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  await db.eventReferenceCounter.deleteMany({ where: { year: YEAR } });
});
afterAll(async () => {
  await db.$disconnect();
});

describe("createEvent", () => {
  it("saves the event and makes the creator its OWNER", async () => {
    const creatorId = await newUser();
    const created = await createEvent(db, { event, creatorId, now: NOW });

    expect(created.reference).toBe(`EVT-${YEAR}-0001`);
    const saved = await db.event.findUniqueOrThrow({
      where: { id: created.id },
      include: { members: true },
    });
    expect(saved).toMatchObject({ ...event, status: "DRAFT", createdById: creatorId });
    expect(saved.members).toEqual([expect.objectContaining({ userId: creatorId, role: "OWNER" })]);
  });

  it("numbers events one after another within the Philippine year", async () => {
    const creatorId = await newUser();
    const refs = [];
    for (let i = 0; i < 3; i++)
      refs.push((await createEvent(db, { event, creatorId, now: NOW })).reference);
    expect(refs).toEqual([`EVT-${YEAR}-0001`, `EVT-${YEAR}-0002`, `EVT-${YEAR}-0003`]);
  });

  it("gives concurrent creations distinct numbers", async () => {
    const creatorId = await newUser();
    const created = await Promise.all(
      Array.from({ length: 5 }, () => createEvent(db, { event, creatorId, now: NOW })),
    );
    expect(new Set(created.map((c) => c.reference)).size).toBe(5);
  });

  it("rolls everything back when saving fails, leaving no gap in the numbers", async () => {
    const creatorId = await newUser();
    await expect(
      createEvent(db, { event: { ...event, name: "x".repeat(121) }, creatorId, now: NOW }),
    ).rejects.toThrow();
    expect(await db.event.count({ where: { createdById: creatorId } })).toBe(0);
    expect(await db.eventReferenceCounter.findUnique({ where: { year: YEAR } })).toBeNull();

    const next = await createEvent(db, { event, creatorId, now: NOW });
    expect(next.reference).toBe(`EVT-${YEAR}-0001`);
  });

  it("refuses a creator with no users row", async () => {
    await expect(createEvent(db, { event, creatorId: randomUUID(), now: NOW })).rejects.toThrow();
    expect(await db.eventReferenceCounter.findUnique({ where: { year: YEAR } })).toBeNull();
  });
});