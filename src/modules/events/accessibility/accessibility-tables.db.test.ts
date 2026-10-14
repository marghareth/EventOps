// src/modules/events/accessibility/accessibility-tables.db.test.ts
// Database tests for the accessibility tables (B3-01, D-056): requirements belong to one attendee of
// one event and can't cross events (D-002); resources belong to one event, one per type; the CHECK
// constraints; cascades with the attendee (D-045) and the event (D-004); indexes. Run with
// `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

const YEAR = 2089;
let db: PrismaClient;
const userIds: string[] = [];
let sequence = 0;

/** An event with an Owner and one attendee, written directly: this file tests the tables only. */
async function setup() {
  const owner = randomUUID();
  userIds.push(owner);
  await db.user.create({
    data: { id: owner, email: `${owner}@example.test`, displayName: "Mika" },
  });
  sequence += 1;
  const event = await db.event.create({
    data: {
      reference: `EVT-${YEAR}-${String(sequence).padStart(4, "0")}-${owner.slice(0, 4)}`,
      name: "Santos wedding",
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      createdById: owner,
      members: { create: { userId: owner, role: "OWNER" } },
    },
  });
  const attendee = await db.attendee.create({
    data: {
      eventId: event.id,
      number: 1,
      name: "Maria Santos",
      rsvpStatus: "CONFIRMED",
      plusOnes: 0,
    },
  });
  return { eventId: event.id, attendeeId: attendee.id };
}

function insertRequirement(
  eventId: string,
  attendeeId: string,
  values: { type?: string; priority?: string; note?: string | null } = {},
) {
  const note = values.note === undefined || values.note === null ? "NULL" : `'${values.note}'`;
  return db.$executeRawUnsafe(
    `INSERT INTO accessibility_requirements (id, "eventId", "attendeeId", type, priority, note, "updatedAt")
     VALUES ('${randomUUID()}', '${eventId}', '${attendeeId}', '${values.type ?? "ACCESSIBLE_SEATING"}',
             '${values.priority ?? "REQUIRED"}', ${note}, now())`,
  );
}

function insertResource(
  eventId: string,
  values: { type?: string; status?: string; quantity?: number | null; note?: string } = {},
) {
  const type = values.type ?? "ACCESSIBLE_SEATS";
  const quantity =
    values.quantity === undefined ? (type === "ACCESSIBLE_SEATS" ? "4" : "NULL") : values.quantity;
  return db.$executeRawUnsafe(
    `INSERT INTO accessibility_resources (id, "eventId", type, status, quantity, note, "updatedAt")
     VALUES ('${randomUUID()}', '${eventId}', '${type}', '${values.status ?? "AVAILABLE"}',
             ${quantity === null ? "NULL" : quantity}, ${values.note === undefined ? "NULL" : `'${values.note}'`}, now())`,
  );
}

beforeAll(() => {
  db = createPrismaClient(url);
});
afterEach(async () => {
  await db.event.deleteMany({ where: { createdById: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
});
afterAll(async () => {
  await db.$disconnect();
});

describe("the accessibility_requirements table", () => {
  it("stores several needs for one attendee, one row each", async () => {
    const { eventId, attendeeId } = await setup();
    await insertRequirement(eventId, attendeeId, { type: "ACCESSIBLE_SEATING" });
    await insertRequirement(eventId, attendeeId, { type: "CAPTIONING", priority: "PREFERRED" });
    await insertRequirement(eventId, attendeeId, { type: "OTHER", note: "Quiet room" });
    expect(await db.accessibilityRequirement.count({ where: { attendeeId } })).toBe(3);
  });

  it("allows each type once per attendee", async () => {
    const { eventId, attendeeId } = await setup();
    await insertRequirement(eventId, attendeeId, { type: "CAPTIONING" });
    await expect(insertRequirement(eventId, attendeeId, { type: "CAPTIONING" })).rejects.toThrow(
      /accessibility_requirements_eventId_attendeeId_type_key/,
    );
  });

  it("refuses a requirement that points at another event's attendee (D-002)", async () => {
    const a = await setup();
    const b = await setup();
    await expect(insertRequirement(a.eventId, b.attendeeId)).rejects.toThrow(
      /accessibility_requirements_eventId_attendeeId_fkey/,
    );
    await expect(insertRequirement(a.eventId, randomUUID())).rejects.toThrow(
      /accessibility_requirements_eventId_attendeeId_fkey/,
    );
  });

  it.each([
    [
      "an Other need without a note",
      { type: "OTHER" },
      /accessibility_requirements_other_has_note/,
    ],
    ["a blank note", { note: "   " }, /accessibility_requirements_note_not_blank/],
    ["a note over 500 characters", { note: "a".repeat(501) }, /too long/],
    ["a type outside the list", { type: "DIETARY" }, /accessibility_requirement_type/],
    ["a priority outside the list", { priority: "MUST" }, /requirement_priority/],
  ])("refuses %s", async (_label, values, error) => {
    const { eventId, attendeeId } = await setup();
    await expect(insertRequirement(eventId, attendeeId, values)).rejects.toThrow(error);
  });

  it("accepts a 500-character note", async () => {
    const { eventId, attendeeId } = await setup();
    await expect(insertRequirement(eventId, attendeeId, { note: "a".repeat(500) })).resolves.toBe(
      1,
    );
  });

  it("goes with its attendee (D-045), and the attendee's other event-mates keep theirs", async () => {
    const { eventId, attendeeId } = await setup();
    const other = await db.attendee.create({
      data: { eventId, number: 2, name: "Ben Lim", rsvpStatus: "PENDING", plusOnes: 0 },
    });
    await insertRequirement(eventId, attendeeId);
    await insertRequirement(eventId, other.id);
    await db.attendee.delete({ where: { id: attendeeId } });
    expect(await db.accessibilityRequirement.count({ where: { eventId } })).toBe(1);
  });

  it("goes with its event (D-004), and only that event's requirements go", async () => {
    const a = await setup();
    const b = await setup();
    await insertRequirement(a.eventId, a.attendeeId);
    await insertRequirement(b.eventId, b.attendeeId);
    await db.event.delete({ where: { id: a.eventId } });
    expect(await db.accessibilityRequirement.count({ where: { eventId: a.eventId } })).toBe(0);
    expect(await db.accessibilityRequirement.count({ where: { eventId: b.eventId } })).toBe(1);
  });

  it("has the per-attendee, per-type and cross-event link indexes", async () => {
    const rows = await db.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'accessibility_requirements'`;
    const defs = rows.map((row) => row.indexdef.replace(/^.* USING btree /, ""));
    expect(defs).toEqual(
      expect.arrayContaining([
        '("eventId", "attendeeId", type)',
        '("eventId", id)',
        '("eventId", type)',
      ]),
    );
  });
});

describe("the accessibility_resources table", () => {
  it("holds one row per resource type per event", async () => {
    const a = await setup();
    const b = await setup();
    await insertResource(a.eventId, { type: "CAPTIONING", status: "ARRANGING" });
    await expect(insertResource(a.eventId, { type: "CAPTIONING" })).rejects.toThrow(
      /accessibility_resources_eventId_type_key/,
    );
    await expect(insertResource(b.eventId, { type: "CAPTIONING" })).resolves.toBe(1);
  });

  it.each([
    ["seats without a count", { type: "ACCESSIBLE_SEATS", quantity: null }],
    ["a negative seat count", { type: "ACCESSIBLE_SEATS", quantity: -1 }],
    ["a count on a resource other than seats", { type: "CAPTIONING", quantity: 2 }],
  ])("refuses %s", async (_label, values) => {
    const { eventId } = await setup();
    await expect(insertResource(eventId, values)).rejects.toThrow(
      /accessibility_resources_quantity_rule/,
    );
  });

  it.each([
    ["a blank note", { note: " " }, /accessibility_resources_note_not_blank/],
    ["a status outside the list", { status: "READY" }, /resource_status/],
    ["a type outside the list", { type: "SHUTTLE" }, /accessibility_resource_type/],
  ])("refuses %s", async (_label, values, error) => {
    const { eventId } = await setup();
    await expect(insertResource(eventId, values)).rejects.toThrow(error);
  });

  it("accepts 0 seats and every non-seat type without a count", async () => {
    const { eventId } = await setup();
    await expect(insertResource(eventId, { quantity: 0 })).resolves.toBe(1);
    for (const type of [
      "ACCESSIBLE_ENTRANCE",
      "RAMP_OR_ELEVATOR",
      "ACCESSIBLE_RESTROOM",
      "CAPTIONING",
      "SIGN_LANGUAGE",
    ]) {
      await expect(insertResource(eventId, { type, status: "NOT_AVAILABLE" })).resolves.toBe(1);
    }
  });

  it("refuses a resource without an existing event, and goes with its event (D-004)", async () => {
    await expect(insertResource(randomUUID())).rejects.toThrow(
      /accessibility_resources_eventId_fkey/,
    );
    const a = await setup();
    const b = await setup();
    await insertResource(a.eventId);
    await insertResource(b.eventId);
    await db.event.delete({ where: { id: a.eventId } });
    expect(await db.accessibilityResource.count({ where: { eventId: a.eventId } })).toBe(0);
    expect(await db.accessibilityResource.count({ where: { eventId: b.eventId } })).toBe(1);
  });

  it("sets createdAt and updatedAt, and moves updatedAt on edit", async () => {
    const { eventId } = await setup();
    // Through Prisma, as the app writes it (raw now() would use the server's time zone).
    const created = await db.accessibilityResource.create({
      data: { eventId, type: "ACCESSIBLE_SEATS", status: "AVAILABLE", quantity: 4 },
    });
    expect(created.createdAt).toBeInstanceOf(Date);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await db.accessibilityResource.update({ where: { id: created.id }, data: { quantity: 6 } });
    const edited = await db.accessibilityResource.findUniqueOrThrow({ where: { id: created.id } });
    expect(edited.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect(edited.createdAt).toEqual(created.createdAt);
  });
});