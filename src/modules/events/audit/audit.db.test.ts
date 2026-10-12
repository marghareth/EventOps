// src/modules/events/audit/audit.db.test.ts
// Database tests for the audit log (B1-11, D-037): what is recorded, that it is append-only, and
// that it is written in the same transaction as the change. Run with `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db";
import { createEvent } from "../create-event";
import type { NewEvent } from "../schema";
import { updateEvent } from "../update-event";
import { listAuditEntries } from "./queries";
import { writeAudit } from "./write";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

const YEAR = 2098;
let db: PrismaClient;
const userIds: string[] = [];

const details: NewEvent = {
  name: "Santos wedding",
  venue: "Cebu",
  description: "Private notes about the family",
  startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
  endsAt: null,
  capacity: 200,
  expectedAttendees: 180,
};

async function newUser(name = "Mika") {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: name } });
  return id;
}

async function newEvent(ownerId: string) {
  return createEvent(db, { event: details, creatorId: ownerId, now: new Date(`${YEAR}-01-01`) });
}

const entries = (eventId: string) =>
  db.auditLog.findMany({ where: { eventId }, orderBy: { createdAt: "asc" } });

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

describe("what an entry records", () => {
  it("creating an event records event, actor, action, entity, time and details", async () => {
    const owner = await newUser();
    const before = new Date();
    const { id, reference } = await newEvent(owner);
    const [entry] = await entries(id);
    expect(entry).toMatchObject({
      eventId: id,
      actorId: owner,
      action: "event.created",
      entityType: "event",
      entityId: id,
      details: { reference, name: "Santos wedding" },
    });
    expect(entry.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  it("editing records only the changed fields, old → new, and never the description text", async () => {
    const owner = await newUser();
    const { id } = await newEvent(owner);
    const version = (await db.event.findUniqueOrThrow({ where: { id } })).updatedAt;
    await updateEvent(db, {
      eventId: id,
      editorId: owner,
      version,
      details: { ...details, venue: "Manila", expectedAttendees: 220, description: "New secret" },
    });
    const updated = (await entries(id)).find((entry) => entry.action === "event.updated");
    expect(updated).toMatchObject({
      actorId: owner,
      entityType: "event",
      entityId: id,
      details: {
        changes: {
          venue: { from: "Cebu", to: "Manila" },
          expectedAttendees: { from: 180, to: 220 },
          description: { changed: true },
        },
      },
    });
    expect(JSON.stringify(updated?.details)).not.toMatch(/secret|Private notes/);
  });

  it("an edit that changes nothing, a stale edit and a refused edit record nothing", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const { id } = await newEvent(owner);
    await db.eventMember.create({ data: { eventId: id, userId: viewer, role: "VIEWER" } });
    const version = (await db.event.findUniqueOrThrow({ where: { id } })).updatedAt;

    await updateEvent(db, { eventId: id, editorId: owner, version, details });
    await updateEvent(db, {
      eventId: id,
      editorId: viewer,
      version,
      details: { ...details, venue: "X" },
    });
    await updateEvent(db, {
      eventId: id,
      editorId: owner,
      version: new Date(0),
      details: { ...details, venue: "Y" },
    });
    expect((await entries(id)).map((entry) => entry.action)).toEqual(["event.created"]);
  });
});

describe("written in the same transaction as the change", () => {
  it("if the audit entry fails, the event is not created", async () => {
    // A creator with no users row cannot be the actor (foreign key), so the whole create fails.
    await expect(
      createEvent(db, { event: details, creatorId: randomUUID(), now: new Date(`${YEAR}-01-01`) }),
    ).rejects.toThrow();
    expect(
      await db.event.count({ where: { name: details.name, createdById: { in: userIds } } }),
    ).toBe(0);
  });

  it("if the audit entry fails, the edit is rolled back", async () => {
    const owner = await newUser();
    const { id } = await newEvent(owner);
    const version = (await db.event.findUniqueOrThrow({ where: { id } })).updatedAt;
    await expect(
      db.$transaction(async (tx) => {
        await tx.event.update({ where: { id }, data: { venue: "Rolled back" } });
        await writeAudit(tx, {
          eventId: id,
          actorId: owner,
          action: "event.updated",
          entityId: id,
          details: { changes: {} },
        });
      }),
    ).rejects.toThrow();
    expect(await db.event.findUniqueOrThrow({ where: { id } })).toMatchObject({
      venue: "Cebu",
      updatedAt: version,
    });
  });
});

describe("audit records cannot be modified", () => {
  it("rejects direct updates and deletes, and keeps the entry", async () => {
    const owner = await newUser();
    const { id } = await newEvent(owner);
    await expect(
      db.auditLog.updateMany({ where: { eventId: id }, data: { action: "event.updated" } }),
    ).rejects.toThrow(/audit_logs_append_only/);
    await expect(db.auditLog.deleteMany({ where: { eventId: id } })).rejects.toThrow(
      /audit_logs_append_only/,
    );
    expect(await entries(id)).toEqual([expect.objectContaining({ action: "event.created" })]);
  });

  it.each([
    ["an action in the wrong format", { action: "Event Updated" }],
    ["an entity type without an ID", { entityType: "event", entityId: null }],
  ])("the database refuses %s", async (_label, data) => {
    const owner = await newUser();
    const { id } = await newEvent(owner);
    await expect(
      db.auditLog.create({
        data: {
          eventId: id,
          actorId: owner,
          action: "event.updated",
          entityType: "event",
          entityId: id,
          ...data,
        },
      }),
    ).rejects.toThrow();
  });

  it("goes with its event (D-004) and survives a deleted actor, without the actor", async () => {
    const owner = await newUser();
    const coordinator = await newUser("Coordinator");
    const { id } = await newEvent(owner);
    await db.eventMember.create({
      data: { eventId: id, userId: coordinator, role: "COORDINATOR" },
    });
    const version = (await db.event.findUniqueOrThrow({ where: { id } })).updatedAt;
    await updateEvent(db, {
      eventId: id,
      editorId: coordinator,
      version,
      details: { ...details, venue: "Iloilo" },
    });

    await db.user.delete({ where: { id: coordinator } });
    const listed = await listAuditEntries(db, id);
    expect(listed.map((entry) => [entry.action, entry.actorName])).toEqual([
      ["event.updated", null],
      ["event.created", "Mika"],
    ]);

    await db.event.delete({ where: { id } });
    expect(await db.auditLog.count({ where: { eventId: id } })).toBe(0);
  });
});

describe("listAuditEntries", () => {
  it("lists only this event's entries, newest first, with valid details", async () => {
    const owner = await newUser();
    const a = await newEvent(owner);
    const b = await newEvent(owner);
    const listed = await listAuditEntries(db, a.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      action: "event.created",
      details: { reference: a.reference },
    });
    expect(
      listed.some((entry) => (entry.details as { reference?: string }).reference === b.reference),
    ).toBe(false);
  });
});