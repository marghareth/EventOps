// src/modules/events/accessibility/requirements.db.test.ts
// Accessibility requirement use cases against PostgreSQL (B3-03, D-056 to D-059): what is saved,
// what Activity records (never the note), one need per type, stale and unchanged saves, the role
// re-checked in the database, and isolation between events and attendees. Run with
// `npm run test:db`.
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
const { createAttendee } = await import("../attendees/create-attendee");
const { deleteAttendee } = await import("../attendees/delete-attendee");
const { prismaAccessibilityRepository } =
  await import("./infrastructure/prisma-accessibility-repository");
const { addRequirement } = await import("./application/add-requirement");
const { updateRequirement } = await import("./application/update-requirement");
const { removeRequirement } = await import("./application/remove-requirement");
const { getReadiness } = await import("./application/get-readiness");
type RequirementInput = import("./domain/requirement").RequirementInput;

const YEAR = 2087;
let db: PrismaClient;
const userIds: string[] = [];
const repo = () => prismaAccessibilityRepository(db);

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
  return id;
}

/** An event with an Owner, a Coordinator and a Viewer, and one attendee (ATT-0001). */
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
  const created = await createAttendee(db, {
    eventId,
    creatorId: owner,
    attendee: {
      name: "Maria Santos",
      email: null,
      phone: null,
      category: null,
      rsvpStatus: "CONFIRMED",
      plusOnes: 0,
      dietaryNeeds: null,
      notes: null,
    },
  });
  if (!created.ok) throw new Error("createAttendee refused");
  return {
    eventId,
    owner,
    coordinator: await member("COORDINATOR"),
    viewer: await member("VIEWER"),
    attendeeId: created.attendee.id,
  };
}

const seating = {
  type: "ACCESSIBLE_SEATING",
  priority: "REQUIRED",
  note: "Uses a wheelchair",
} as const;

async function add(
  eventId: string,
  attendeeId: string,
  actorId: string,
  input: RequirementInput = seating,
) {
  const result = await addRequirement(repo(), { eventId, attendeeId, actorId, input });
  if (!result.ok) throw new Error(`addRequirement refused: ${result.reason}`);
  return result.id;
}

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

describe("adding a requirement", () => {
  it.each(["owner", "coordinator"] as const)(
    "saves it for a %s and records the type and priority, never the note",
    async (who) => {
      const w = await setup();
      const id = await add(w.eventId, w.attendeeId, w[who]);
      expect(await db.accessibilityRequirement.findUniqueOrThrow({ where: { id } })).toMatchObject({
        eventId: w.eventId,
        attendeeId: w.attendeeId,
        ...seating,
      });
      const [entry] = await auditFor(w.eventId, "accessibility_requirement.created");
      expect(entry).toMatchObject({
        actorId: w[who],
        entityType: "accessibility_requirement",
        entityId: id,
        details: { reference: "ATT-0001", type: "ACCESSIBLE_SEATING", priority: "REQUIRED" },
      });
      expect(JSON.stringify(entry.details)).not.toMatch(/wheelchair|Maria/);
    },
  );

  it("keeps several needs for one attendee, listed in definition order", async () => {
    const w = await setup();
    await add(w.eventId, w.attendeeId, w.owner, {
      type: "OTHER",
      priority: "INFORMATIONAL",
      note: "Guide dog",
    });
    await add(w.eventId, w.attendeeId, w.owner, {
      type: "CAPTIONING",
      priority: "PREFERRED",
      note: null,
    });
    await add(w.eventId, w.attendeeId, w.owner);
    const listed = await repo().listRequirements(w.eventId, w.attendeeId, { withNotes: true });
    expect(listed.map((r) => r.type)).toEqual(["ACCESSIBLE_SEATING", "CAPTIONING", "OTHER"]);
    expect(listed.map((r) => r.note)).toEqual(["Uses a wheelchair", null, "Guide dog"]);
  });

  it("never loads notes for a reader who may not see them (D-058)", async () => {
    const w = await setup();
    await add(w.eventId, w.attendeeId, w.owner);
    const [row] = await repo().listRequirements(w.eventId, w.attendeeId, { withNotes: false });
    expect(row).not.toHaveProperty("note");
    expect(row).toMatchObject({ type: "ACCESSIBLE_SEATING", priority: "REQUIRED" });
  });

  it("refuses a second need of the same type, even from two requests at once", async () => {
    const w = await setup();
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        addRequirement(repo(), {
          eventId: w.eventId,
          attendeeId: w.attendeeId,
          actorId: w.owner,
          input: seating,
        }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      { ok: false, reason: "duplicate" },
      { ok: false, reason: "duplicate" },
    ]);
    expect(await db.accessibilityRequirement.count({ where: { attendeeId: w.attendeeId } })).toBe(
      1,
    );
  });

  it("refuses a Viewer, a non-member and another event's attendee, saving nothing", async () => {
    const a = await setup();
    const b = await setup();
    const stranger = await newUser();
    for (const [eventId, attendeeId, actorId] of [
      [a.eventId, a.attendeeId, a.viewer],
      [a.eventId, a.attendeeId, stranger],
      [a.eventId, b.attendeeId, a.owner],
      [b.eventId, b.attendeeId, a.owner],
      [a.eventId, randomUUID(), a.owner],
    ]) {
      expect(
        await addRequirement(repo(), { eventId, attendeeId, actorId, input: seating }),
      ).toEqual({ ok: false, reason: "not-found" });
    }
    expect(
      await db.accessibilityRequirement.count({
        where: { eventId: { in: [a.eventId, b.eventId] } },
      }),
    ).toBe(0);
    expect(
      await db.auditLog.count({
        where: { action: { startsWith: "accessibility" }, eventId: { in: [a.eventId, b.eventId] } },
      }),
    ).toBe(0);
  });
});

describe("editing a requirement", () => {
  async function current(id: string) {
    return db.accessibilityRequirement.findUniqueOrThrow({ where: { id } });
  }

  it("saves the change and records old → new, with the note only as changed", async () => {
    const w = await setup();
    const id = await add(w.eventId, w.attendeeId, w.owner);
    const { updatedAt } = await current(id);
    const result = await updateRequirement(repo(), {
      eventId: w.eventId,
      attendeeId: w.attendeeId,
      requirementId: id,
      actorId: w.coordinator,
      version: updatedAt,
      input: { type: "ACCESSIBLE_SEATING", priority: "PREFERRED", note: "Aisle seat" },
    });
    expect(result).toEqual({ ok: true });
    expect(await current(id)).toMatchObject({ priority: "PREFERRED", note: "Aisle seat" });
    const [entry] = await auditFor(w.eventId, "accessibility_requirement.updated");
    expect(entry.details).toEqual({
      reference: "ATT-0001",
      type: "ACCESSIBLE_SEATING",
      changes: { priority: { from: "REQUIRED", to: "PREFERRED" }, note: { changed: true } },
    });
    expect(JSON.stringify(entry.details)).not.toMatch(/Aisle|wheelchair/);
  });

  it("writes and records nothing when nothing changed", async () => {
    const w = await setup();
    const id = await add(w.eventId, w.attendeeId, w.owner);
    const before = await current(id);
    const result = await updateRequirement(repo(), {
      eventId: w.eventId,
      attendeeId: w.attendeeId,
      requirementId: id,
      actorId: w.owner,
      version: before.updatedAt,
      input: seating,
    });
    expect(result).toEqual({ ok: true, unchanged: true });
    expect((await current(id)).updatedAt).toEqual(before.updatedAt);
    expect(await auditFor(w.eventId, "accessibility_requirement.updated")).toHaveLength(0);
  });

  it("refuses a stale save (D-032)", async () => {
    const w = await setup();
    const id = await add(w.eventId, w.attendeeId, w.owner);
    const old = (await current(id)).updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
    await db.accessibilityRequirement.update({
      where: { id },
      data: { priority: "INFORMATIONAL" },
    });
    const result = await updateRequirement(repo(), {
      eventId: w.eventId,
      attendeeId: w.attendeeId,
      requirementId: id,
      actorId: w.owner,
      version: old,
      input: { ...seating, priority: "PREFERRED" },
    });
    expect(result).toEqual({ ok: false, reason: "stale" });
    expect((await current(id)).priority).toBe("INFORMATIONAL");
  });

  it("refuses changing to a type the attendee already has", async () => {
    const w = await setup();
    await add(w.eventId, w.attendeeId, w.owner);
    const id = await add(w.eventId, w.attendeeId, w.owner, {
      type: "CAPTIONING",
      priority: "REQUIRED",
      note: null,
    });
    const result = await updateRequirement(repo(), {
      eventId: w.eventId,
      attendeeId: w.attendeeId,
      requirementId: id,
      actorId: w.owner,
      version: (await current(id)).updatedAt,
      input: { type: "ACCESSIBLE_SEATING", priority: "REQUIRED", note: null },
    });
    expect(result).toEqual({ ok: false, reason: "duplicate" });
    expect((await current(id)).type).toBe("CAPTIONING");
  });

  it("refuses a Viewer, another attendee's path and another event, changing nothing", async () => {
    const a = await setup();
    const b = await setup();
    const id = await add(a.eventId, a.attendeeId, a.owner);
    const { updatedAt } = await current(id);
    const attempts = [
      { eventId: a.eventId, attendeeId: a.attendeeId, actorId: a.viewer },
      { eventId: b.eventId, attendeeId: a.attendeeId, actorId: b.owner },
      { eventId: a.eventId, attendeeId: b.attendeeId, actorId: a.owner },
    ];
    for (const attempt of attempts) {
      const result = await updateRequirement(repo(), {
        ...attempt,
        requirementId: id,
        version: updatedAt,
        input: { ...seating, priority: "PREFERRED" },
      });
      expect(result).toEqual({ ok: false, reason: "not-found" });
    }
    expect((await current(id)).priority).toBe("REQUIRED");
  });
});

describe("removing a requirement", () => {
  it("deletes it permanently and records the attendee and type", async () => {
    const w = await setup();
    const id = await add(w.eventId, w.attendeeId, w.owner);
    const result = await removeRequirement(repo(), {
      eventId: w.eventId,
      attendeeId: w.attendeeId,
      requirementId: id,
      actorId: w.coordinator,
    });
    expect(result).toEqual({ ok: true, type: "ACCESSIBLE_SEATING" });
    expect(await db.accessibilityRequirement.count({ where: { id } })).toBe(0);
    const [entry] = await auditFor(w.eventId, "accessibility_requirement.deleted");
    expect(entry.details).toEqual({ reference: "ATT-0001", type: "ACCESSIBLE_SEATING" });
    expect(
      await removeRequirement(repo(), {
        eventId: w.eventId,
        attendeeId: w.attendeeId,
        requirementId: id,
        actorId: w.owner,
      }),
    ).toEqual({ ok: false, reason: "not-found" });
  });

  it("refuses a Viewer and another event's member", async () => {
    const a = await setup();
    const b = await setup();
    const id = await add(a.eventId, a.attendeeId, a.owner);
    for (const [eventId, actorId] of [
      [a.eventId, a.viewer],
      [b.eventId, b.owner],
      [a.eventId, b.owner],
    ]) {
      expect(
        await removeRequirement(repo(), {
          eventId,
          attendeeId: a.attendeeId,
          requirementId: id,
          actorId,
        }),
      ).toEqual({ ok: false, reason: "not-found" });
    }
    expect(await db.accessibilityRequirement.count({ where: { id } })).toBe(1);
  });

  it("goes with the attendee when they are removed (D-045)", async () => {
    const w = await setup();
    await add(w.eventId, w.attendeeId, w.owner);
    await deleteAttendee(db, { eventId: w.eventId, attendeeId: w.attendeeId, userId: w.owner });
    expect(await db.accessibilityRequirement.count({ where: { eventId: w.eventId } })).toBe(0);
  });
});

describe("readiness from stored data (B3-10)", () => {
  it("reads every need of this event with its guest's RSVP, never notes or other events", async () => {
    const a = await setup();
    const b = await setup();
    await add(a.eventId, a.attendeeId, a.owner);
    await add(b.eventId, b.attendeeId, b.owner, {
      type: "CAPTIONING",
      priority: "REQUIRED",
      note: "B",
    });
    const rows = await repo().listEventRequirements(a.eventId);
    expect(rows).toEqual([
      {
        id: expect.any(String),
        type: "ACCESSIBLE_SEATING",
        priority: "REQUIRED",
        attendee: { id: a.attendeeId, number: 1, name: "Maria Santos", rsvpStatus: "CONFIRMED" },
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain("wheelchair");
  });

  it("calculates readiness from what is stored, and follows changes", async () => {
    const w = await setup();
    await add(w.eventId, w.attendeeId, w.owner);
    expect((await getReadiness(repo(), w.eventId)).status).toBe("NOT_READY");
    await db.accessibilityResource.create({
      data: { eventId: w.eventId, type: "ACCESSIBLE_SEATS", status: "AVAILABLE", quantity: 1 },
    });
    expect((await getReadiness(repo(), w.eventId)).status).toBe("READY");
    await db.attendee.update({ where: { id: w.attendeeId }, data: { rsvpStatus: "DECLINED" } });
    expect((await getReadiness(repo(), w.eventId)).status).toBe("NO_REQUIRED_NEEDS");
  });
});