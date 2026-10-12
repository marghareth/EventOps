// src/modules/events/members/membership.db.test.ts
// Event membership and isolation in one place (B1-07). Each test names the acceptance criterion it
// covers. Run with `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db";
import { createEvent } from "../create-event";
import { deleteEvent } from "../delete-event";
import { getEventForMember, listEventsForUser } from "../queries";
import { updateEvent } from "../update-event";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

const YEAR = 2096;
let db: PrismaClient;
const userIds: string[] = [];

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
  return id;
}

const details = (name: string) => ({
  name,
  venue: null,
  description: null,
  startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
  endsAt: null,
  capacity: null,
  expectedAttendees: 0,
});

async function newEvent(ownerId: string, name: string) {
  const { id } = await createEvent(db, {
    event: details(name),
    creatorId: ownerId,
    now: new Date(`${YEAR}-01-01T00:00:00Z`),
  });
  return id;
}

async function join(eventId: string, userId: string, role: "OWNER" | "COORDINATOR" | "VIEWER") {
  await db.eventMember.create({ data: { eventId, userId, role } });
}

/** Two owners, each with their own event. */
async function twoEvents() {
  const ana = await newUser();
  const ben = await newUser();
  const eventA = await newEvent(ana, "Event A");
  const eventB = await newEvent(ben, "Event B");
  return { ana, ben, eventA, eventB };
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

describe("a user can belong to an event, and to several", () => {
  it("belongs to the event they create, as its Owner", async () => {
    const { ana, eventA } = await twoEvents();
    expect((await getEventForMember(db, eventA, ana))?.role).toBe("OWNER");
  });

  it("belongs to several events with a different role in each", async () => {
    const { ana, ben, eventA, eventB } = await twoEvents();
    const cara = await newUser();
    await join(eventA, cara, "COORDINATOR");
    await join(eventB, cara, "VIEWER");

    expect((await getEventForMember(db, eventA, cara))?.role).toBe("COORDINATOR");
    expect((await getEventForMember(db, eventB, cara))?.role).toBe("VIEWER");
    const listed = await listEventsForUser(db, cara);
    expect(listed.map((e) => [e.name, e.role]).sort()).toEqual([
      ["Event A", "COORDINATOR"],
      ["Event B", "VIEWER"],
    ]);
    // The owners still see only their own event.
    expect((await listEventsForUser(db, ana)).map((e) => e.name)).toEqual(["Event A"]);
    expect((await listEventsForUser(db, ben)).map((e) => e.name)).toEqual(["Event B"]);
  });
});

describe("membership is scoped to one event: knowing an ID is not enough", () => {
  it("a member of event A cannot read, list, edit or delete event B", async () => {
    const { ana, eventB } = await twoEvents();
    const b = await db.event.findUniqueOrThrow({ where: { id: eventB } });

    expect(await getEventForMember(db, eventB, ana)).toBeNull();
    expect((await listEventsForUser(db, ana)).map((e) => e.id)).not.toContain(eventB);
    expect(
      await updateEvent(db, {
        eventId: eventB,
        editorId: ana,
        version: b.updatedAt,
        details: details("Taken over"),
      }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect(await deleteEvent(db, { eventId: eventB, userId: ana })).toEqual({ ok: false });
    expect(await db.event.findUniqueOrThrow({ where: { id: eventB } })).toMatchObject({
      name: "Event B",
    });
  });

  it("an unknown event ID and another user's event ID look the same", async () => {
    const { ana, eventB } = await twoEvents();
    expect(await getEventForMember(db, eventB, ana)).toEqual(
      await getEventForMember(db, randomUUID(), ana),
    );
  });

  it("a removed member loses access at once", async () => {
    const { eventA } = await twoEvents();
    const cara = await newUser();
    await join(eventA, cara, "COORDINATOR");
    expect(await getEventForMember(db, eventA, cara)).not.toBeNull();
    await db.eventMember.delete({ where: { eventId_userId: { eventId: eventA, userId: cara } } });
    expect(await getEventForMember(db, eventA, cara)).toBeNull();
    expect(await listEventsForUser(db, cara)).toEqual([]);
  });

  it("an event's members are not shared with any other event", async () => {
    const { eventA, eventB } = await twoEvents();
    const cara = await newUser();
    await join(eventA, cara, "VIEWER");
    expect(await db.eventMember.count({ where: { eventId: eventB, userId: cara } })).toBe(0);
  });
});

describe("a membership has exactly one supported role", () => {
  it("one membership per user per event, so never two roles at once", async () => {
    const { eventA } = await twoEvents();
    const cara = await newUser();
    await join(eventA, cara, "VIEWER");
    await expect(join(eventA, cara, "COORDINATOR")).rejects.toThrow();
    expect(await db.eventMember.findMany({ where: { eventId: eventA, userId: cara } })).toEqual([
      expect.objectContaining({ role: "VIEWER" }),
    ]);
  });

  it("changing the role replaces it", async () => {
    const { eventA } = await twoEvents();
    const cara = await newUser();
    await join(eventA, cara, "VIEWER");
    await db.eventMember.update({
      where: { eventId_userId: { eventId: eventA, userId: cara } },
      data: { role: "COORDINATOR" },
    });
    expect((await getEventForMember(db, eventA, cara))?.role).toBe("COORDINATOR");
  });

  it.each([["ADMIN"], ["owner"], [""]])("the database refuses the role %j", async (role) => {
    const { eventA } = await twoEvents();
    const cara = await newUser();
    await expect(
      db.$executeRawUnsafe(
        `INSERT INTO event_members (id, "eventId", "userId", role) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::member_role)`,
        randomUUID(),
        eventA,
        cara,
        role,
      ),
    ).rejects.toThrow();
  });

  it("the database refuses a membership without a role", async () => {
    const { eventA } = await twoEvents();
    const cara = await newUser();
    await expect(
      db.$executeRaw`INSERT INTO event_members (id, "eventId", "userId", role)
        VALUES (${randomUUID()}::uuid, ${eventA}::uuid, ${cara}::uuid, NULL)`,
    ).rejects.toThrow();
  });

  it("the supported roles are exactly Owner, Coordinator and Viewer", async () => {
    const rows = await db.$queryRaw<{ value: string }[]>`
      SELECT unnest(enum_range(NULL::member_role))::text AS value`;
    expect(rows.map((row) => row.value)).toEqual(["OWNER", "COORDINATOR", "VIEWER"]);
  });
});