// src/modules/events/update-event.db.test.ts
// Database tests for editing an event (B1-05). Run with `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db";
import { createEvent } from "./create-event";
import type { NewEvent } from "./schema";
import { updateEvent } from "./update-event";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

const YEAR = 2094;
let db: PrismaClient;
const userIds: string[] = [];

const original: NewEvent = {
  name: "Santos wedding",
  venue: "Cebu",
  description: null,
  startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
  endsAt: null,
  capacity: 200,
  expectedAttendees: 180,
};
const changed: NewEvent = {
  name: "Santos–Lim wedding",
  venue: "Manila",
  description: "Garden ceremony",
  startsAt: new Date(`${YEAR}-12-13T02:00:00Z`),
  endsAt: new Date(`${YEAR}-12-13T10:00:00Z`),
  capacity: 250,
  expectedAttendees: 220,
};

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
  return id;
}

async function setup() {
  const ownerId = await newUser();
  const { id } = await createEvent(db, {
    event: original,
    creatorId: ownerId,
    now: new Date(`${YEAR}-01-01`),
  });
  const event = await db.event.findUniqueOrThrow({ where: { id } });
  return { ownerId, eventId: id, version: event.updatedAt, before: event };
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

describe("updateEvent", () => {
  it("saves the editable details and nothing else, moving updatedAt forward", async () => {
    const { ownerId, eventId, version, before } = await setup();
    expect(
      await updateEvent(db, { eventId, editorId: ownerId, version, details: changed }),
    ).toEqual({
      ok: true,
    });
    const after = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(after).toMatchObject(changed);
    expect(after).toMatchObject({
      reference: before.reference,
      status: before.status,
      createdById: before.createdById,
      createdAt: before.createdAt,
    });
    expect(after.updatedAt.getTime()).toBeGreaterThan(version.getTime());
  });

  it("lets a Coordinator edit", async () => {
    const { eventId, version } = await setup();
    const coordinator = await newUser();
    await db.eventMember.create({ data: { eventId, userId: coordinator, role: "COORDINATOR" } });
    expect(
      await updateEvent(db, { eventId, editorId: coordinator, version, details: changed }),
    ).toEqual({ ok: true });
  });

  it("refuses a Viewer at the database level and changes nothing", async () => {
    const { eventId, version } = await setup();
    const viewer = await newUser();
    await db.eventMember.create({ data: { eventId, userId: viewer, role: "VIEWER" } });
    expect(await updateEvent(db, { eventId, editorId: viewer, version, details: changed })).toEqual(
      {
        ok: false,
        reason: "not-found",
      },
    );
    expect(await db.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject(original);
  });

  it("refuses a non-member, and an unknown event, the same way", async () => {
    const { eventId, version } = await setup();
    const outsider = await newUser();
    for (const id of [eventId, randomUUID()]) {
      expect(
        await updateEvent(db, { eventId: id, editorId: outsider, version, details: changed }),
      ).toEqual({
        ok: false,
        reason: "not-found",
      });
    }
    expect(await db.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject(original);
  });

  it("refuses a stale save: the second of two edits from the same version", async () => {
    const { ownerId, eventId, version } = await setup();
    await updateEvent(db, { eventId, editorId: ownerId, version, details: changed });
    expect(
      await updateEvent(db, {
        eventId,
        editorId: ownerId,
        version,
        details: { ...original, name: "Overwrite attempt" },
      }),
    ).toEqual({ ok: false, reason: "stale" });
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).name).toBe(changed.name);
  });

  it("lets the database reject values that break its rules", async () => {
    const { ownerId, eventId, version } = await setup();
    await expect(
      updateEvent(db, {
        eventId,
        editorId: ownerId,
        version,
        details: { ...changed, capacity: 0 },
      }),
    ).rejects.toThrow();
    expect(await db.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject(original);
  });
});