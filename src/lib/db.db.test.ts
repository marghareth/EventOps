// src/lib/db.db.test.ts
// Database integration tests for B0-08. Run with `npm run test:db` against a migrated test
// database in TEST_DATABASE_URL (see CONTRIBUTING.md). Not part of `npm test`.
// Every row uses random ids and is deleted afterwards, so the suite can run repeatedly.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "./db";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
}
// Safety: refuse to run against a database whose name does not say it is for tests.
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

let db: PrismaClient;
const createdUserIds: string[] = [];
const createdEventIds: string[] = [];
const TEST_YEAR = 2999;

beforeAll(() => {
  db = createPrismaClient(url);
});

afterEach(async () => {
  await db.event.deleteMany({ where: { id: { in: createdEventIds.splice(0) } } });
  await db.user.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
  await db.eventReferenceCounter.deleteMany({ where: { year: TEST_YEAR } });
});

afterAll(async () => {
  await db.$disconnect();
});

async function makeUser(overrides: Partial<{ email: string; displayName: string }> = {}) {
  const id = randomUUID();
  createdUserIds.push(id);
  return db.user.create({
    data: {
      id,
      displayName: overrides.displayName ?? "Test User",
      email: overrides.email ?? `${id}@example.test`,
    },
  });
}

type EventInput = {
  name?: string;
  venue?: string | null;
  description?: string | null;
  capacity?: number | null;
  expectedAttendees?: number;
  startsAt?: Date;
  endsAt?: Date | null;
  reference?: string;
  /** Who gets the OWNER membership (D-022). Defaults to the creator; null creates none. */
  ownerId?: string | null;
};

/** Creates an event and, in the same statement, its OWNER membership (D-022). */
async function makeEvent(createdById: string, input: EventInput = {}) {
  const id = randomUUID();
  createdEventIds.push(id);
  const ownerId = input.ownerId === undefined ? createdById : input.ownerId;
  return db.event.create({
    data: {
      id,
      reference: input.reference ?? `EVT-TEST-${id}`,
      name: input.name ?? "Santos wedding",
      venue: input.venue,
      description: input.description,
      startsAt: input.startsAt ?? new Date("2026-12-12T08:00:00Z"),
      endsAt: input.endsAt,
      capacity: input.capacity,
      expectedAttendees: input.expectedAttendees,
      createdById,
      members: ownerId ? { create: { userId: ownerId, role: "OWNER" } } : undefined,
    },
  });
}

/** Asserts that a write is rejected, by Prisma error code or by database constraint name. */
async function expectRejected(
  write: Promise<unknown>,
  expected: { code?: string; constraint?: string },
) {
  const error = await write.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error, "the write should have been rejected").not.toBeNull();
  const details = error as { code?: string; message?: string; meta?: unknown };
  if (expected.code) expect(details.code).toBe(expected.code);
  if (expected.constraint) {
    expect(`${details.message ?? ""} ${JSON.stringify(details.meta ?? {})}`).toContain(
      expected.constraint,
    );
  }
}

describe("migrations", () => {
  it("has applied every migration folder, none failed or rolled back", async () => {
    const dir = path.resolve(__dirname, "../../prisma/migrations");
    const onDisk = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const rows = await db.$queryRaw<
      { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
    >`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;
    const applied = rows
      .filter((row) => row.finished_at !== null && row.rolled_back_at === null)
      .map((row) => row.migration_name)
      .sort();
    expect(applied).toEqual(onDisk);
  });

  it("creates exactly the expected tables (B0-08; audit_logs B1-11; attendees B2-01; accessibility B3-01; suppliers B4-01)", async () => {
    const rows = await db.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
      ORDER BY table_name`;
    expect(rows.map((row) => row.table_name)).toEqual([
      "accessibility_requirements",
      "accessibility_resources",
      "attendees",
      "audit_logs",
      "event_members",
      "event_reference_counters",
      "events",
      "supplier_payments",
      "supplier_quotes",
      "suppliers",
      "users",
    ]);
  });
});

describe("Prisma client round trip", () => {
  it("creates a user, an event and a membership, and reads them back with relations", async () => {
    const owner = await makeUser({ displayName: "Mika" });
    const event = await makeEvent(owner.id, { capacity: 200, expectedAttendees: 180 });

    const loaded = await db.event.findUniqueOrThrow({
      where: { id: event.id },
      include: { createdBy: true, members: { include: { user: true } } },
    });

    expect(loaded.status).toBe("DRAFT");
    expect(loaded.createdBy.displayName).toBe("Mika");
    expect(loaded.members).toHaveLength(1);
    expect(loaded.members[0]).toMatchObject({ role: "OWNER", user: { id: owner.id } });
  });

  it("applies defaults: expectedAttendees 0, status DRAFT, timestamps set", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    expect(event.expectedAttendees).toBe(0);
    expect(event.status).toBe("DRAFT");
    expect(event.createdAt).toBeInstanceOf(Date);
    expect(event.updatedAt).toBeInstanceOf(Date);
  });
});

describe("unique constraints", () => {
  it("rejects a second user with the same email", async () => {
    const email = `${randomUUID()}@example.test`;
    await makeUser({ email });
    await expectRejected(makeUser({ email }), { code: "P2002" });
  });

  it("rejects a second event with the same reference", async () => {
    const owner = await makeUser();
    const reference = `EVT-TEST-${randomUUID()}`;
    await makeEvent(owner.id, { reference });
    await expectRejected(makeEvent(owner.id, { reference }), { code: "P2002" });
  });

  it("rejects a second membership for the same user and event", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    await expectRejected(
      db.eventMember.create({ data: { eventId: event.id, userId: owner.id, role: "VIEWER" } }),
      { code: "P2002" },
    );
  });

  it("allows the same user in two different events", async () => {
    const user = await makeUser();
    const other = await makeUser();
    await makeEvent(user.id);
    const second = await makeEvent(other.id);
    await db.eventMember.create({ data: { eventId: second.id, userId: user.id, role: "VIEWER" } });
    expect(await db.eventMember.count({ where: { userId: user.id } })).toBe(2);
  });
});

describe("event CHECK constraints", () => {
  it.each([
    ["an empty name", { name: "" }, "events_name_not_blank"],
    ["a name of only spaces", { name: "   " }, "events_name_not_blank"],
    ["capacity 0", { capacity: 0 }, "events_capacity_positive"],
    ["a negative capacity", { capacity: -5 }, "events_capacity_positive"],
    ["negative expected attendees", { expectedAttendees: -1 }, "events_expected_attendees_nonneg"],
    [
      "an end before the start",
      { startsAt: new Date("2026-12-12T08:00:00Z"), endsAt: new Date("2026-12-12T07:59:59Z") },
      "events_ends_not_before_start",
    ],
  ])("rejects %s", async (_label, input: EventInput, constraint) => {
    const owner = await makeUser();
    await expectRejected(makeEvent(owner.id, input), { constraint });
  });

  it("accepts the boundary values", async () => {
    const owner = await makeUser();
    const at = new Date("2026-12-12T08:00:00Z");
    const event = await makeEvent(owner.id, {
      name: " x ",
      capacity: 1,
      expectedAttendees: 0,
      startsAt: at,
      endsAt: at,
    });
    expect(event).toMatchObject({ capacity: 1, expectedAttendees: 0 });
  });

  it("accepts a missing capacity and end time", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id, { capacity: null, endsAt: null });
    expect(event).toMatchObject({ capacity: null, endsAt: null });
  });
});

describe("foreign keys and deletion", () => {
  it("rejects an event whose creator does not exist", async () => {
    await expectRejected(makeEvent(randomUUID()), { code: "P2003" });
  });

  it("rejects a membership for a user or event that does not exist", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    await expectRejected(
      db.eventMember.create({ data: { eventId: event.id, userId: randomUUID(), role: "VIEWER" } }),
      { code: "P2003" },
    );
    await expectRejected(
      db.eventMember.create({ data: { eventId: randomUUID(), userId: owner.id, role: "VIEWER" } }),
      { code: "P2003" },
    );
  });

  it("blocks deleting a user who created an event, and changes nothing", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    await expectRejected(db.user.delete({ where: { id: owner.id } }), { code: "P2003" });
    expect(await db.user.count({ where: { id: owner.id } })).toBe(1);
    expect(await db.event.count({ where: { id: event.id } })).toBe(1);
  });

  it("deleting an event removes its memberships but keeps the users", async () => {
    const owner = await makeUser();
    const coordinator = await makeUser();
    const event = await makeEvent(owner.id);
    await db.eventMember.create({
      data: { eventId: event.id, userId: coordinator.id, role: "COORDINATOR" },
    });

    await db.event.delete({ where: { id: event.id } });

    expect(await db.eventMember.count({ where: { eventId: event.id } })).toBe(0);
    expect(await db.user.count({ where: { id: { in: [owner.id, coordinator.id] } } })).toBe(2);
  });

  it("deleting a user who only has memberships removes those memberships", async () => {
    const owner = await makeUser();
    const viewer = await makeUser();
    const event = await makeEvent(owner.id);
    await db.eventMember.create({ data: { eventId: event.id, userId: viewer.id, role: "VIEWER" } });

    await db.user.delete({ where: { id: viewer.id } });

    expect(await db.eventMember.count({ where: { userId: viewer.id } })).toBe(0);
    expect(await db.event.count({ where: { id: event.id } })).toBe(1);
  });
});

describe("event ownership (B1-01, D-022)", () => {
  const OWNER_RULE = "events_must_have_owner";

  it("gives a new event its creator as OWNER", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    await expect(
      db.eventMember.findMany({
        where: { eventId: event.id },
        select: { userId: true, role: true },
      }),
    ).resolves.toEqual([{ userId: owner.id, role: "OWNER" }]);
  });

  it("rejects an event created without any OWNER membership", async () => {
    const owner = await makeUser();
    await expectRejected(makeEvent(owner.id, { ownerId: null }), { constraint: OWNER_RULE });
  });

  it("rejects an event whose only member is a VIEWER", async () => {
    const owner = await makeUser();
    const id = randomUUID();
    createdEventIds.push(id);
    await expectRejected(
      db.event.create({
        data: {
          id,
          reference: `EVT-TEST-${id}`,
          name: "Viewer only",
          startsAt: new Date("2026-12-12T08:00:00Z"),
          createdById: owner.id,
          members: { create: { userId: owner.id, role: "VIEWER" } },
        },
      }),
      { constraint: OWNER_RULE },
    );
    expect(await db.event.count({ where: { id } })).toBe(0);
  });

  it("accepts the event and its OWNER as two steps in one transaction (checked at commit)", async () => {
    const owner = await makeUser();
    const id = randomUUID();
    createdEventIds.push(id);
    await db.$transaction(async (tx) => {
      await tx.event.create({
        data: {
          id,
          reference: `EVT-TEST-${id}`,
          name: "Two steps",
          startsAt: new Date("2026-12-12T08:00:00Z"),
          createdById: owner.id,
        },
      });
      await tx.eventMember.create({ data: { eventId: id, userId: owner.id, role: "OWNER" } });
    });
    expect(await db.event.count({ where: { id } })).toBe(1);
  });

  it("rejects removing the last OWNER membership, and keeps it", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    await expectRejected(
      db.eventMember.deleteMany({ where: { eventId: event.id, userId: owner.id } }),
      { constraint: OWNER_RULE },
    );
    expect(await db.eventMember.count({ where: { eventId: event.id, role: "OWNER" } })).toBe(1);
  });

  it("rejects demoting the last OWNER", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    await expectRejected(
      db.eventMember.updateMany({
        where: { eventId: event.id, userId: owner.id },
        data: { role: "COORDINATOR" },
      }),
      { constraint: OWNER_RULE },
    );
  });

  it("rejects moving the last OWNER membership to another event", async () => {
    const owner = await makeUser();
    const first = await makeEvent(owner.id);
    const otherOwner = await makeUser();
    const second = await makeEvent(otherOwner.id);
    await expectRejected(
      db.eventMember.updateMany({
        where: { eventId: first.id, userId: owner.id },
        data: { eventId: second.id },
      }),
      { constraint: OWNER_RULE },
    );
  });

  it("allows removing an OWNER while another OWNER remains", async () => {
    const owner = await makeUser();
    const coOwner = await makeUser();
    const event = await makeEvent(owner.id);
    await db.eventMember.create({ data: { eventId: event.id, userId: coOwner.id, role: "OWNER" } });
    await db.eventMember.deleteMany({ where: { eventId: event.id, userId: owner.id } });
    await expect(
      db.eventMember.findMany({ where: { eventId: event.id }, select: { userId: true } }),
    ).resolves.toEqual([{ userId: coOwner.id }]);
  });

  it("blocks deleting a user who is an event's last OWNER (resolves open item 8)", async () => {
    const creator = await makeUser();
    const soleOwner = await makeUser();
    const event = await makeEvent(creator.id, { ownerId: soleOwner.id });
    await expectRejected(db.user.delete({ where: { id: soleOwner.id } }), {
      constraint: OWNER_RULE,
    });
    expect(await db.user.count({ where: { id: soleOwner.id } })).toBe(1);
    expect(await db.eventMember.count({ where: { eventId: event.id, role: "OWNER" } })).toBe(1);
  });

  it("still deletes a whole event together with its memberships", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    await db.event.delete({ where: { id: event.id } });
    expect(await db.eventMember.count({ where: { eventId: event.id } })).toBe(0);
  });
});

describe("event text limits (B1-01, D-023)", () => {
  it.each([
    ["name", 120],
    ["venue", 200],
    ["description", 5000],
  ] as const)("accepts a %s of exactly %i characters and rejects one more", async (field, max) => {
    const owner = await makeUser();
    const ok = await makeEvent(owner.id, { [field]: "a".repeat(max) });
    expect(ok[field]).toHaveLength(max);
    await expectRejected(makeEvent(owner.id, { [field]: "a".repeat(max + 1) }), { code: "P2000" });
  });

  it("counts characters, not bytes", async () => {
    const owner = await makeUser();
    const name = "ñ".repeat(120);
    const event = await makeEvent(owner.id, { name });
    expect(event.name).toBe(name);
  });
});

describe("event timestamps (B1-01)", () => {
  it("sets createdAt and updatedAt on create", async () => {
    const owner = await makeUser();
    const before = Date.now();
    const event = await makeEvent(owner.id);
    expect(event.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(event.updatedAt.getTime()).toBeGreaterThanOrEqual(event.createdAt.getTime() - 5);
  });

  it("moves updatedAt forward on edit and leaves createdAt alone", async () => {
    const owner = await makeUser();
    const event = await makeEvent(owner.id);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const edited = await db.event.update({
      where: { id: event.id },
      data: { name: "Santos-Reyes wedding" },
    });
    expect(edited.updatedAt.getTime()).toBeGreaterThan(event.updatedAt.getTime());
    expect(edited.createdAt.getTime()).toBe(event.createdAt.getTime());
  });
});

describe("event reference counter", () => {
  it("issues distinct, consecutive numbers under concurrent use", async () => {
    const takeNumber = () =>
      db.$queryRaw<{ lastNumber: number }[]>`
        INSERT INTO event_reference_counters (year, "lastNumber", "updatedAt")
        VALUES (${TEST_YEAR}, 1, now())
        ON CONFLICT (year) DO UPDATE
          SET "lastNumber" = event_reference_counters."lastNumber" + 1, "updatedAt" = now()
        RETURNING "lastNumber"`;

    const results = await Promise.all(Array.from({ length: 25 }, takeNumber));
    const numbers = results.map((rows) => rows[0].lastNumber).sort((a, b) => a - b);

    expect(numbers).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });
});