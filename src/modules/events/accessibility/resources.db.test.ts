// src/modules/events/accessibility/resources.db.test.ts
// Event accessibility resource use cases against PostgreSQL (B3-05, D-061): set up, edit, remove,
// what Activity records, one per type (also two at once), stale and unchanged saves, the role
// re-checked in the database, and isolation between events. Run with `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

const { createEvent } = await import("../create-event");
const { prismaAccessibilityRepository } =
  await import("./infrastructure/prisma-accessibility-repository");
const { saveResource } = await import("./application/save-resource");
const { removeResource } = await import("./application/remove-resource");

const YEAR = 2085;
let db: PrismaClient;
const userIds: string[] = [];
const repo = () => prismaAccessibilityRepository(db);

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
  return id;
}

async function setup() {
  const owner = await newUser();
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
    creatorId: owner,
    now: new Date(`${YEAR}-01-01`),
  });
  const member = async (role: MemberRole) => {
    const userId = await newUser();
    await db.eventMember.create({ data: { eventId, userId, role } });
    return userId;
  };
  return {
    eventId,
    owner,
    coordinator: await member("COORDINATOR"),
    viewer: await member("VIEWER"),
  };
}

const seats = { status: "ARRANGING", quantity: 6, note: null } as const;
const stored = (eventId: string, type = "ACCESSIBLE_SEATS" as const) =>
  db.accessibilityResource.findFirst({ where: { eventId, type } });
const auditFor = (eventId: string, action: string) =>
  db.auditLog.findMany({ where: { eventId, action }, orderBy: { createdAt: "asc" } });

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

describe("setting up a resource", () => {
  it.each(["owner", "coordinator"] as const)("saves it for a %s and records it", async (who) => {
    const w = await setup();
    const result = await saveResource(repo(), {
      eventId: w.eventId,
      type: "ACCESSIBLE_SEATS",
      actorId: w[who],
      version: null,
      input: seats,
    });
    expect(result).toEqual({ ok: true });
    expect(await stored(w.eventId)).toMatchObject(seats);
    const [entry] = await auditFor(w.eventId, "accessibility_resource.created");
    expect(entry).toMatchObject({
      actorId: w[who],
      entityType: "accessibility_resource",
      details: { type: "ACCESSIBLE_SEATS", status: "ARRANGING", quantity: 6 },
    });
  });

  it("never overwrites a resource someone set up meanwhile, even two at once", async () => {
    const w = await setup();
    const results = await Promise.all(
      [1, 2, 3].map((n) =>
        saveResource(repo(), {
          eventId: w.eventId,
          type: "ACCESSIBLE_SEATS",
          actorId: w.owner,
          version: null,
          input: { ...seats, quantity: n },
        }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      { ok: false, reason: "exists" },
      { ok: false, reason: "exists" },
    ]);
    expect(await db.accessibilityResource.count({ where: { eventId: w.eventId } })).toBe(1);
  });

  it("refuses a Viewer and a non-member, saving nothing", async () => {
    const w = await setup();
    const stranger = await newUser();
    for (const actorId of [w.viewer, stranger]) {
      expect(
        await saveResource(repo(), {
          eventId: w.eventId,
          type: "CAPTIONING",
          actorId,
          version: null,
          input: { status: "AVAILABLE", quantity: null, note: null },
        }),
      ).toEqual({ ok: false, reason: "not-found" });
    }
    expect(await db.accessibilityResource.count({ where: { eventId: w.eventId } })).toBe(0);
    expect(
      await db.auditLog.count({
        where: { eventId: w.eventId, action: { startsWith: "accessibility" } },
      }),
    ).toBe(0);
  });
});

describe("editing a resource", () => {
  async function setUp() {
    const w = await setup();
    await saveResource(repo(), {
      eventId: w.eventId,
      type: "ACCESSIBLE_SEATS",
      actorId: w.owner,
      version: null,
      input: seats,
    });
    const resource = await stored(w.eventId);
    return { ...w, version: resource!.updatedAt };
  }

  it("saves the change and records old → new, with the note only as changed", async () => {
    const w = await setUp();
    const result = await saveResource(repo(), {
      eventId: w.eventId,
      type: "ACCESSIBLE_SEATS",
      actorId: w.coordinator,
      version: w.version,
      input: { status: "AVAILABLE", quantity: 8, note: "Front left" },
    });
    expect(result).toEqual({ ok: true });
    expect(await stored(w.eventId)).toMatchObject({
      status: "AVAILABLE",
      quantity: 8,
      note: "Front left",
    });
    const [entry] = await auditFor(w.eventId, "accessibility_resource.updated");
    expect(entry.details).toEqual({
      type: "ACCESSIBLE_SEATS",
      changes: {
        status: { from: "ARRANGING", to: "AVAILABLE" },
        quantity: { from: 6, to: 8 },
        note: { changed: true },
      },
    });
  });

  it("writes and records nothing when nothing changed", async () => {
    const w = await setUp();
    expect(
      await saveResource(repo(), {
        eventId: w.eventId,
        type: "ACCESSIBLE_SEATS",
        actorId: w.owner,
        version: w.version,
        input: seats,
      }),
    ).toEqual({ ok: true, unchanged: true });
    expect((await stored(w.eventId))!.updatedAt).toEqual(w.version);
    expect(await auditFor(w.eventId, "accessibility_resource.updated")).toHaveLength(0);
  });

  it("refuses a stale save (D-032)", async () => {
    const w = await setUp();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await db.accessibilityResource.updateMany({
      where: { eventId: w.eventId },
      data: { status: "NOT_AVAILABLE" },
    });
    expect(
      await saveResource(repo(), {
        eventId: w.eventId,
        type: "ACCESSIBLE_SEATS",
        actorId: w.owner,
        version: w.version,
        input: { ...seats, quantity: 9 },
      }),
    ).toEqual({ ok: false, reason: "stale" });
    expect((await stored(w.eventId))!.quantity).toBe(6);
  });

  it("refuses a Viewer and another event's Owner, changing nothing", async () => {
    const a = await setUp();
    const b = await setup();
    for (const [eventId, actorId] of [
      [a.eventId, a.viewer],
      [a.eventId, b.owner],
    ]) {
      expect(
        await saveResource(repo(), {
          eventId,
          type: "ACCESSIBLE_SEATS",
          actorId,
          version: a.version,
          input: { ...seats, quantity: 9 },
        }),
      ).toEqual({ ok: false, reason: "not-found" });
    }
    // Event B has no seats set up: editing "its" seats with Event A's version finds nothing.
    expect(
      await saveResource(repo(), {
        eventId: b.eventId,
        type: "ACCESSIBLE_SEATS",
        actorId: b.owner,
        version: a.version,
        input: seats,
      }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect((await stored(a.eventId))!.quantity).toBe(6);
  });
});

describe("removing a resource", () => {
  it("deletes it so it is Not set up again, and records the type", async () => {
    const w = await setup();
    await saveResource(repo(), {
      eventId: w.eventId,
      type: "RAMP_OR_ELEVATOR",
      actorId: w.owner,
      version: null,
      input: { status: "AVAILABLE", quantity: null, note: null },
    });
    expect(
      await removeResource(repo(), {
        eventId: w.eventId,
        type: "RAMP_OR_ELEVATOR",
        actorId: w.coordinator,
      }),
    ).toEqual({ ok: true });
    expect(await repo().findResource(w.eventId, "RAMP_OR_ELEVATOR")).toBeNull();
    const [entry] = await auditFor(w.eventId, "accessibility_resource.deleted");
    expect(entry.details).toEqual({ type: "RAMP_OR_ELEVATOR" });
    expect(
      await removeResource(repo(), {
        eventId: w.eventId,
        type: "RAMP_OR_ELEVATOR",
        actorId: w.owner,
      }),
    ).toEqual({ ok: false, reason: "not-found" });
  });

  it("refuses a Viewer and another event's Owner", async () => {
    const a = await setup();
    const b = await setup();
    await saveResource(repo(), {
      eventId: a.eventId,
      type: "CAPTIONING",
      actorId: a.owner,
      version: null,
      input: { status: "AVAILABLE", quantity: null, note: null },
    });
    for (const actorId of [a.viewer, b.owner]) {
      expect(
        await removeResource(repo(), { eventId: a.eventId, type: "CAPTIONING", actorId }),
      ).toEqual({
        ok: false,
        reason: "not-found",
      });
    }
    expect(await repo().findResource(a.eventId, "CAPTIONING")).not.toBeNull();
  });
});

it("lists only this event's resources, in definition order", async () => {
  const a = await setup();
  const b = await setup();
  for (const type of ["SIGN_LANGUAGE", "ACCESSIBLE_ENTRANCE"] as const) {
    await saveResource(repo(), {
      eventId: a.eventId,
      type,
      actorId: a.owner,
      version: null,
      input: { status: "AVAILABLE", quantity: null, note: null },
    });
  }
  await saveResource(repo(), {
    eventId: b.eventId,
    type: "CAPTIONING",
    actorId: b.owner,
    version: null,
    input: { status: "AVAILABLE", quantity: null, note: null },
  });
  expect((await repo().listResources(a.eventId)).map((r) => r.type)).toEqual([
    "ACCESSIBLE_ENTRANCE",
    "SIGN_LANGUAGE",
  ]);
});