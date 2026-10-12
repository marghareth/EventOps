// src/modules/events/queries.db.test.ts
// Database tests for the event list (B1-03): membership is the only way an event is listed.
// Run with `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db";
import { createEvent } from "./create-event";
import { getEventForMember, listEventsForUser } from "./queries";
import type { NewEvent } from "./schema";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

const YEAR = 2092;
const NOW = new Date(`${YEAR}-06-01T00:00:00Z`);
let db: PrismaClient;
const userIds: string[] = [];

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
  return id;
}

function event(name: string, startsAt: string): NewEvent {
  return {
    name,
    venue: "Cebu",
    description: "Private notes",
    startsAt: new Date(startsAt),
    endsAt: null,
    capacity: 200,
    expectedAttendees: 180,
  };
}

async function create(creatorId: string, name: string, startsAt = `${YEAR}-12-12T08:00:00Z`) {
  return createEvent(db, { event: event(name, startsAt), creatorId, now: NOW });
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

describe("listEventsForUser", () => {
  it("lists the user's own events with their role and only the listed fields", async () => {
    const mika = await newUser();
    const created = await create(mika, "Santos wedding");
    const [listed] = await listEventsForUser(db, mika);
    expect(listed).toEqual({
      id: created.id,
      reference: created.reference,
      name: "Santos wedding",
      venue: "Cebu",
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      endsAt: null,
      status: "DRAFT",
      expectedAttendees: 180,
      role: "OWNER",
    });
  });

  it("never lists another user's events", async () => {
    const mika = await newUser();
    const other = await newUser();
    await create(mika, "Mika's event");
    await create(other, "Someone else's event");
    expect((await listEventsForUser(db, mika)).map((e) => e.name)).toEqual(["Mika's event"]);
    expect((await listEventsForUser(db, other)).map((e) => e.name)).toEqual([
      "Someone else's event",
    ]);
  });

  it("returns nothing for a user with no memberships, or an unknown user", async () => {
    const mika = await newUser();
    const nobody = await newUser();
    await create(mika, "Santos wedding");
    expect(await listEventsForUser(db, nobody)).toEqual([]);
    expect(await listEventsForUser(db, randomUUID())).toEqual([]);
  });

  it("shows a shared event to each member with their own role", async () => {
    const owner = await newUser();
    const coordinator = await newUser();
    const created = await create(owner, "Shared event");
    await db.eventMember.create({
      data: { eventId: created.id, userId: coordinator, role: "COORDINATOR" },
    });
    expect((await listEventsForUser(db, owner))[0].role).toBe("OWNER");
    expect(await listEventsForUser(db, coordinator)).toEqual([
      expect.objectContaining({ id: created.id, role: "COORDINATOR" }),
    ]);
  });

  it("stops listing an event once the user is removed from it", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const created = await create(owner, "Shared event");
    await db.eventMember.create({ data: { eventId: created.id, userId: viewer, role: "VIEWER" } });
    expect(await listEventsForUser(db, viewer)).toHaveLength(1);

    await db.eventMember.delete({
      where: { eventId_userId: { eventId: created.id, userId: viewer } },
    });
    expect(await listEventsForUser(db, viewer)).toEqual([]);
  });

  it("returns events in start order", async () => {
    const mika = await newUser();
    await create(mika, "Later", `${YEAR}-12-12T08:00:00Z`);
    await create(mika, "Sooner", `${YEAR}-07-01T08:00:00Z`);
    expect((await listEventsForUser(db, mika)).map((e) => e.name)).toEqual(["Sooner", "Later"]);
  });
});

describe("getEventForMember (B1-04)", () => {
  it("returns the event's details and the member's role", async () => {
    const mika = await newUser();
    const created = await create(mika, "Santos wedding");
    expect(await getEventForMember(db, created.id, mika)).toEqual({
      id: created.id,
      reference: created.reference,
      name: "Santos wedding",
      venue: "Cebu",
      description: "Private notes",
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      endsAt: null,
      status: "DRAFT",
      capacity: 200,
      expectedAttendees: 180,
      role: "OWNER",
    });
  });

  it("returns null for another user's event, just as for an unknown one", async () => {
    const mika = await newUser();
    const other = await newUser();
    const created = await create(other, "Someone else's event");
    expect(await getEventForMember(db, created.id, mika)).toBeNull();
    expect(await getEventForMember(db, randomUUID(), mika)).toBeNull();
  });

  it("gives each member their own role, and nothing once removed", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const created = await create(owner, "Shared event");
    await db.eventMember.create({ data: { eventId: created.id, userId: viewer, role: "VIEWER" } });
    expect((await getEventForMember(db, created.id, viewer))?.role).toBe("VIEWER");

    await db.eventMember.delete({
      where: { eventId_userId: { eventId: created.id, userId: viewer } },
    });
    expect(await getEventForMember(db, created.id, viewer)).toBeNull();
    expect((await getEventForMember(db, created.id, owner))?.role).toBe("OWNER");
  });
});