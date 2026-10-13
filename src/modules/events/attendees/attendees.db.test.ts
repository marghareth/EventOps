// src/modules/events/attendees/attendees.db.test.ts
// Database tests for attendees (B2-01, D-042): the table's rules, and the create, edit and delete
// use cases with roles, isolation between events and the audit log. Run with `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/db";
import { createEvent } from "../create-event";
import { createAttendee } from "./create-attendee";
import { deleteAttendee } from "./delete-attendee";
import { getAttendee, listAttendees } from "./queries";
import type { AttendeeInput } from "./schema";
import { updateAttendee } from "./update-attendee";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

const YEAR = 2093;
let db: PrismaClient;
const userIds: string[] = [];

const maria: AttendeeInput = {
  name: "Maria Santos",
  email: "maria@example.com",
  phone: "0917 123 4567",
  category: "Family",
  rsvpStatus: "PENDING",
  plusOnes: 1,
  dietaryNeeds: "Vegetarian",
  notes: "Seat near the stage",
};

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
  return id;
}

/** An event with an Owner, plus a Coordinator and a Viewer. */
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

async function add(eventId: string, creatorId: string, attendee: Partial<AttendeeInput> = {}) {
  const result = await createAttendee(db, {
    eventId,
    creatorId,
    attendee: { ...maria, ...attendee },
  });
  if (!result.ok) throw new Error("createAttendee refused");
  return result.attendee;
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

describe("the attendees table", () => {
  async function rawInsert(eventId: string | null, overrides: Record<string, string> = {}) {
    const values = {
      number: "1",
      name: "'Maria'",
      rsvpStatus: "'PENDING'",
      plusOnes: "0",
      email: "NULL",
      ...overrides,
    };
    return db.$executeRawUnsafe(
      `INSERT INTO attendees (id, "eventId", number, name, "rsvpStatus", "plusOnes", email, "updatedAt")
       VALUES ('${randomUUID()}', ${eventId === null ? "NULL" : `'${eventId}'`}, ${values.number},
               ${values.name}, ${values.rsvpStatus}, ${values.plusOnes}, ${values.email}, now())`,
    );
  }

  it("refuses an attendee without an event, or with an event that doesn't exist", async () => {
    await expect(rawInsert(null)).rejects.toThrow(/null value in column "eventId"/);
    await expect(rawInsert(randomUUID())).rejects.toThrow(/attendees_eventId_fkey/);
  });

  it.each([
    ["an empty name", { name: "''" }, /attendees_name_not_blank/],
    ["a name of only spaces", { name: "'   '" }, /attendees_name_not_blank/],
    ["a name over 120 characters", { name: `'${"a".repeat(121)}'` }, /too long/],
    ["11 plus-ones", { plusOnes: "11" }, /attendees_plus_ones_range/],
    ["negative plus-ones", { plusOnes: "-1" }, /attendees_plus_ones_range/],
    ["number 0", { number: "0" }, /attendees_number_positive/],
    ["an empty email", { email: "''" }, /attendees_optional_text_not_blank/],
    ["an RSVP status outside the list", { rsvpStatus: "'ATTENDING'" }, /rsvp_status/],
    ["a missing RSVP status", { rsvpStatus: "NULL" }, /null value in column "rsvpStatus"/],
  ])("refuses %s", async (_label: string, overrides: Record<string, string>, error: RegExp) => {
    const { eventId } = await setup();
    await expect(rawInsert(eventId, overrides)).rejects.toThrow(error);
  });

  it("accepts the boundary values", async () => {
    const { eventId } = await setup();
    await expect(
      rawInsert(eventId, { name: `'${"a".repeat(120)}'`, plusOnes: "10" }),
    ).resolves.toBe(1);
    await expect(rawInsert(eventId, { number: "2", plusOnes: "0" })).resolves.toBe(1);
  });

  it("allows each number once per event", async () => {
    const a = await setup();
    const b = await setup();
    await rawInsert(a.eventId);
    await expect(rawInsert(a.eventId)).rejects.toThrow(/attendees_eventId_number_key/);
    await expect(rawInsert(b.eventId)).resolves.toBe(1);
  });

  it("has the guest-list, RSVP, number and cross-event link indexes", async () => {
    const rows = await db.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'attendees' ORDER BY indexname`;
    const defs = rows.map((row) => row.indexdef.replace(/^.* USING btree /, ""));
    expect(defs).toEqual(
      expect.arrayContaining([
        '("eventId", name)',
        '("eventId", "rsvpStatus")',
        '("eventId", number)',
        '("eventId", id)',
      ]),
    );
  });

  it("sets createdAt and updatedAt, and moves updatedAt on edit", async () => {
    const { eventId, owner } = await setup();
    const { id } = await add(eventId, owner);
    const created = await db.attendee.findUniqueOrThrow({ where: { id } });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt.getTime()).toBeGreaterThanOrEqual(created.createdAt.getTime());
    await new Promise((resolve) => setTimeout(resolve, 5));
    await db.attendee.update({ where: { id }, data: { notes: "Changed" } });
    const edited = await db.attendee.findUniqueOrThrow({ where: { id } });
    expect(edited.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect(edited.createdAt).toEqual(created.createdAt);
  });

  it("goes with its event (D-004), and only that event's attendees go", async () => {
    const a = await setup();
    const b = await setup();
    await add(a.eventId, a.owner);
    await add(b.eventId, b.owner);
    await db.event.delete({ where: { id: a.eventId } });
    expect(await db.attendee.count({ where: { eventId: a.eventId } })).toBe(0);
    expect(await db.attendee.count({ where: { eventId: b.eventId } })).toBe(1);
  });
});

describe("createAttendee", () => {
  it("saves every field, numbers the attendee and records attendee.created", async () => {
    const { eventId, owner } = await setup();
    const created = await add(eventId, owner);
    expect(created.reference).toBe("ATT-0001");
    expect(await getAttendee(db, eventId, created.id)).toMatchObject({ ...maria, number: 1 });

    const [entry] = await auditFor(eventId, "attendee.created");
    expect(entry).toMatchObject({
      actorId: owner,
      entityType: "attendee",
      entityId: created.id,
      details: { reference: "ATT-0001", name: "Maria Santos" },
    });
    expect(JSON.stringify(entry.details)).not.toMatch(/example\.com|0917|Vegetarian|stage/);
  });

  it("numbers attendees one after another in each event, independently", async () => {
    const a = await setup();
    const b = await setup();
    expect((await add(a.eventId, a.owner)).reference).toBe("ATT-0001");
    expect((await add(a.eventId, a.coordinator)).reference).toBe("ATT-0002");
    expect((await add(b.eventId, b.owner)).reference).toBe("ATT-0001");
  });

  it("gives concurrent additions distinct numbers", async () => {
    const { eventId, owner } = await setup();
    const created = await Promise.all(Array.from({ length: 15 }, () => add(eventId, owner)));
    const numbers = created.map((c) => Number(c.reference.slice(4))).sort((x, y) => x - y);
    expect(numbers).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it("never reuses the number of a removed attendee", async () => {
    const { eventId, owner } = await setup();
    const first = await add(eventId, owner);
    await deleteAttendee(db, { eventId, attendeeId: first.id, userId: owner });
    expect((await add(eventId, owner)).reference).toBe("ATT-0002");
  });

  it("does not move the event's edit version (D-032)", async () => {
    const { eventId, owner } = await setup();
    const before = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    await add(eventId, owner);
    const after = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(after.lastAttendeeNumber).toBe(1);
  });

  it.each(["viewer", "stranger", "unknown event"] as const)(
    "refuses a %s at the database level and saves nothing",
    async (who: "viewer" | "stranger" | "unknown event") => {
      const { eventId, viewer } = await setup();
      const creatorId = who === "viewer" ? viewer : await newUser();
      const target = who === "unknown event" ? randomUUID() : eventId;
      expect(await createAttendee(db, { eventId: target, creatorId, attendee: maria })).toEqual({
        ok: false,
      });
      expect(await db.attendee.count({ where: { eventId } })).toBe(0);
      const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
      expect(event.lastAttendeeNumber).toBe(0);
      expect(await auditFor(eventId, "attendee.created")).toEqual([]);
    },
  );

  it("rolls everything back when the attendee breaks a database rule", async () => {
    const { eventId, owner } = await setup();
    await expect(
      createAttendee(db, { eventId, creatorId: owner, attendee: { ...maria, plusOnes: 11 } }),
    ).rejects.toThrow(/attendees_plus_ones_range/);
    const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.lastAttendeeNumber).toBe(0);
    expect(await auditFor(eventId, "attendee.created")).toEqual([]);
  });
});

describe("updateAttendee", () => {
  async function stored(eventId: string, attendeeId: string) {
    return db.attendee.findUniqueOrThrow({ where: { id: attendeeId, eventId } });
  }

  it("lets an Owner or Coordinator save, records only the changes, personal ones as changed", async () => {
    const { eventId, owner, coordinator } = await setup();
    const { id } = await add(eventId, owner);
    for (const editorId of [owner, coordinator]) {
      const version = (await stored(eventId, id)).updatedAt;
      const plusOnes = editorId === owner ? 2 : 3;
      expect(
        await updateAttendee(db, {
          eventId,
          attendeeId: id,
          editorId,
          version,
          details: { ...maria, rsvpStatus: "CONFIRMED", plusOnes, notes: `Note ${plusOnes}` },
        }),
      ).toEqual({ ok: true });
    }
    expect(await stored(eventId, id)).toMatchObject({ rsvpStatus: "CONFIRMED", plusOnes: 3 });
    const entries = await auditFor(eventId, "attendee.updated");
    expect(entries.map((e) => e.actorId)).toEqual([owner, coordinator]);
    expect(entries[0].details).toEqual({
      reference: "ATT-0001",
      changes: {
        rsvpStatus: { from: "PENDING", to: "CONFIRMED" },
        plusOnes: { from: 1, to: 2 },
        notes: { changed: true },
      },
    });
    expect(JSON.stringify(entries)).not.toContain("Note 2");
  });

  it("records nothing when nothing changed", async () => {
    const { eventId, owner } = await setup();
    const { id } = await add(eventId, owner);
    const { updatedAt } = await stored(eventId, id);
    await updateAttendee(db, {
      eventId,
      attendeeId: id,
      editorId: owner,
      version: updatedAt,
      details: maria,
    });
    expect(await auditFor(eventId, "attendee.updated")).toEqual([]);
  });

  it("refuses a Viewer and a non-member, changing nothing", async () => {
    const { eventId, owner, viewer } = await setup();
    const { id } = await add(eventId, owner);
    const { updatedAt } = await stored(eventId, id);
    for (const editorId of [viewer, await newUser()]) {
      expect(
        await updateAttendee(db, {
          eventId,
          attendeeId: id,
          editorId,
          version: updatedAt,
          details: { ...maria, name: "Changed" },
        }),
      ).toEqual({ ok: false, reason: "not-found" });
    }
    expect((await stored(eventId, id)).name).toBe("Maria Santos");
  });

  it("refuses another event's attendee, even for the Owner of both events", async () => {
    const a = await setup();
    const b = await setup();
    await db.eventMember.create({ data: { eventId: b.eventId, userId: a.owner, role: "OWNER" } });
    const other = await add(b.eventId, b.owner);
    const { updatedAt } = await stored(b.eventId, other.id);
    expect(
      await updateAttendee(db, {
        eventId: a.eventId,
        attendeeId: other.id,
        editorId: a.owner,
        version: updatedAt,
        details: { ...maria, name: "Moved" },
      }),
    ).toEqual({ ok: false, reason: "not-found" });
    expect((await stored(b.eventId, other.id)).name).toBe("Maria Santos");
  });

  it("refuses a stale save: the second of two edits from the same version", async () => {
    const { eventId, owner, coordinator } = await setup();
    const { id } = await add(eventId, owner);
    const { updatedAt: version } = await stored(eventId, id);
    const edit = (editorId: string, name: string) =>
      updateAttendee(db, {
        eventId,
        attendeeId: id,
        editorId,
        version,
        details: { ...maria, name },
      });
    expect(await edit(owner, "First")).toEqual({ ok: true });
    expect(await edit(coordinator, "Second")).toEqual({ ok: false, reason: "stale" });
    expect((await stored(eventId, id)).name).toBe("First");
  });
});

describe("deleteAttendee", () => {
  it("lets a Coordinator remove an attendee and records who it was", async () => {
    const { eventId, owner, coordinator } = await setup();
    const { id } = await add(eventId, owner);
    expect(await deleteAttendee(db, { eventId, attendeeId: id, userId: coordinator })).toEqual({
      ok: true,
    });
    expect(await db.attendee.count({ where: { id } })).toBe(0);
    const [entry] = await auditFor(eventId, "attendee.deleted");
    expect(entry).toMatchObject({
      actorId: coordinator,
      entityId: id,
      details: { reference: "ATT-0001", name: "Maria Santos" },
    });
  });

  it("refuses a Viewer, a non-member and another event's attendee, removing nothing", async () => {
    const a = await setup();
    const b = await setup();
    const mine = await add(a.eventId, a.owner);
    const theirs = await add(b.eventId, b.owner);
    const refused = [
      { eventId: a.eventId, attendeeId: mine.id, userId: a.viewer },
      { eventId: a.eventId, attendeeId: mine.id, userId: b.owner },
      { eventId: a.eventId, attendeeId: theirs.id, userId: a.owner },
      { eventId: a.eventId, attendeeId: randomUUID(), userId: a.owner },
    ];
    for (const args of refused) expect(await deleteAttendee(db, args)).toEqual({ ok: false });
    expect(await db.attendee.count({ where: { id: { in: [mine.id, theirs.id] } } })).toBe(2);
    expect(await auditFor(a.eventId, "attendee.deleted")).toEqual([]);
  });
  it("refuses another event's attendee even for an Owner of both events (rule 7.5)", async () => {
    const a = await setup();
    const b = await setup();
    await db.eventMember.create({ data: { eventId: b.eventId, userId: a.owner, role: "OWNER" } });
    const theirs = await add(b.eventId, b.owner);
    expect(
      await deleteAttendee(db, { eventId: a.eventId, attendeeId: theirs.id, userId: a.owner }),
    ).toEqual({ ok: false });
    expect(await db.attendee.count({ where: { id: theirs.id } })).toBe(1);
  });
});

describe("reading attendees", () => {
  it("lists only this event's attendees, by name, and finds none from another event", async () => {
    const a = await setup();
    const b = await setup();
    await add(a.eventId, a.owner, { name: "Ramon Cruz" });
    await add(a.eventId, a.owner, { name: "Ana Reyes" });
    const other = await add(b.eventId, b.owner, { name: "Belle Tan" });
    expect((await listAttendees(db, a.eventId)).map((x) => x.name)).toEqual([
      "Ana Reyes",
      "Ramon Cruz",
    ]);
    expect(await getAttendee(db, a.eventId, other.id)).toBeNull();
  });
});
