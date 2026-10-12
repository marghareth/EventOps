// src/modules/events/delete-event.db.test.ts
// Database tests for deleting an event (B1-06, D-004). Run with `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db";
import { createEvent } from "./create-event";
import { deleteEvent } from "./delete-event";
import { getEventForMember } from "./queries";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

const YEAR = 2095;
let db: PrismaClient;
const userIds: string[] = [];

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
  return id;
}

async function newEvent(ownerId: string, name = "Santos wedding") {
  const { id } = await createEvent(db, {
    event: {
      name,
      venue: null,
      description: null,
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      endsAt: null,
      capacity: null,
      expectedAttendees: 0,
    },
    creatorId: ownerId,
    now: new Date(`${YEAR}-01-01T00:00:00Z`),
  });
  return id;
}

async function addMember(eventId: string, role: "OWNER" | "COORDINATOR" | "VIEWER") {
  const userId = await newUser();
  await db.eventMember.create({ data: { eventId, userId, role } });
  return userId;
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

describe("deleteEvent", () => {
  it("lets an Owner delete the event with all its memberships, keeping the users", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner);
    const coordinator = await addMember(eventId, "COORDINATOR");

    expect(await deleteEvent(db, { eventId, userId: owner })).toEqual({ ok: true });
    expect(await db.event.count({ where: { id: eventId } })).toBe(0);
    expect(await db.eventMember.count({ where: { eventId } })).toBe(0);
    expect(await db.user.count({ where: { id: { in: [owner, coordinator] } } })).toBe(2);
  });

  it("leaves other events untouched", async () => {
    const owner = await newUser();
    const doomed = await newEvent(owner, "Doomed");
    const kept = await newEvent(owner, "Kept");
    await deleteEvent(db, { eventId: doomed, userId: owner });
    expect(await db.event.findUnique({ where: { id: kept } })).toMatchObject({ name: "Kept" });
    expect(await db.eventMember.count({ where: { eventId: kept } })).toBe(1);
  });

  it("lets a second Owner delete it too", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner);
    const secondOwner = await addMember(eventId, "OWNER");
    expect(await deleteEvent(db, { eventId, userId: secondOwner })).toEqual({ ok: true });
  });

  it.each(["COORDINATOR", "VIEWER"] as const)(
    "refuses a %s at the database level and removes nothing",
    async (role) => {
      const owner = await newUser();
      const eventId = await newEvent(owner);
      const member = await addMember(eventId, role);
      expect(await deleteEvent(db, { eventId, userId: member })).toEqual({ ok: false });
      expect(await db.event.count({ where: { id: eventId } })).toBe(1);
      expect(await db.eventMember.count({ where: { eventId } })).toBe(2);
    },
  );

  it("refuses a non-member, and an unknown event, the same way", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner);
    const outsider = await newUser();
    expect(await deleteEvent(db, { eventId, userId: outsider })).toEqual({ ok: false });
    expect(await deleteEvent(db, { eventId: randomUUID(), userId: owner })).toEqual({ ok: false });
    expect(await db.event.count({ where: { id: eventId } })).toBe(1);
  });

  it("makes the event inaccessible afterwards, and a second delete finds nothing", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner);
    await deleteEvent(db, { eventId, userId: owner });
    expect(await getEventForMember(db, eventId, owner)).toBeNull();
    expect(await deleteEvent(db, { eventId, userId: owner })).toEqual({ ok: false });
  });
});

describe("deletion behaviour of related records (D-004)", () => {
  it("every foreign key that points at events cascades on delete", async () => {
    const rows = await db.$queryRaw<{ table_name: string; delete_rule: string }[]>`
      SELECT tc.table_name, rc.delete_rule
      FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage cu ON cu.constraint_name = rc.unique_constraint_name
      WHERE cu.table_name = 'events' AND tc.table_schema = 'public'
      ORDER BY tc.table_name`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => row.delete_rule !== "CASCADE")).toEqual([]);
  });
});