// src/modules/events/attendees/edit-flow.db.test.ts
// Editing an attendee end to end (B2-03): the real server action, authorization, validation,
// PostgreSQL, the guest list read and the Activity feed. Only the signed-in identity is mocked.
// Run with `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

/** The signed-in user for the next call, or null for signed out. The only thing mocked. */
let signedIn: { id: string; email: string } | null = null;
let db: PrismaClient;

vi.mock("@/lib/auth", () => ({
  AuthUnavailableError: class AuthUnavailableError extends Error {},
  getCurrentUser: async () => signedIn,
  requireUser: async (path: string) => {
    if (!signedIn) throw Object.assign(new Error("NEXT_REDIRECT"), { url: `/login?next=${path}` });
    return signedIn;
  },
  ensureDemoUserRecord: async () => {},
}));
vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  getDb: () => db,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url: to });
  },
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true });
  },
}));

const { createPrismaClient } = await import("@/lib/db");
const { createEvent } = await import("../create-event");
const { getEventActivity } = await import("../activity");
const { describeAuditEntry } = await import("@/modules/events/audit/public");
const { createAttendeeAction, updateAttendeeAction } = await import("./actions");
const { getAttendeeForEditing, getEventAttendees } = await import("./read");
const { expectedHeadcount } = await import("./headcount");
const { ATTENDEE_MESSAGES, initialAttendeeFormState } = await import("./form-state");

const YEAR = 2091;
const userIds: string[] = [];

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
  return { id, email: `${id}@example.test` };
}

async function newEvent(ownerId: string) {
  const { id } = await createEvent(db, {
    event: {
      name: "Santos wedding",
      venue: null,
      description: null,
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      endsAt: null,
      capacity: null,
      expectedAttendees: 0,
    },
    creatorId: ownerId,
    now: new Date(`${YEAR}-01-01`),
  });
  return id;
}

async function join(eventId: string, userId: string, role: MemberRole) {
  await db.eventMember.create({ data: { eventId, userId, role } });
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** Submits the add form as the signed-in user: the action's answer, or its redirect. */
async function submit(eventId: string, fields: Record<string, string>) {
  try {
    return await createAttendeeAction(eventId, initialAttendeeFormState, form(fields));
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirect: url };
    throw error;
  }
}

const maria = {
  name: "Maria Santos",
  email: "Maria@Example.com",
  phone: "0917 123 4567",
  category: "Family",
  rsvpStatus: "CONFIRMED",
  plusOnes: "2",
  dietaryNeeds: "Vegetarian",
  notes: "Seat near the stage",
};

beforeAll(() => {
  db = createPrismaClient(url);
});
beforeEach(() => {
  signedIn = null;
});
afterEach(async () => {
  await db.event.deleteMany({ where: { createdById: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  await db.eventReferenceCounter.deleteMany({ where: { year: YEAR } });
});
afterAll(async () => {
  await db.$disconnect();
});

/** Adds Maria as the signed-in user and returns her stored record. */
async function addMaria(eventId: string) {
  await submit(eventId, maria);
  const found = await db.attendee.findFirstOrThrow({ where: { eventId, name: "Maria Santos" } });
  return found;
}

/** Saves the edit form as the signed-in user: the action's answer, or its redirect. */
async function save(eventId: string, attendeeId: string, fields: Record<string, string>) {
  try {
    return await updateAttendeeAction(eventId, attendeeId, initialAttendeeFormState, form(fields));
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirect: url };
    throw error;
  }
}

const edited = { ...maria, rsvpStatus: "DECLINED", plusOnes: "0", notes: "Can't make it" };

describe("editing an attendee", () => {
  it("loads, saves every field, shows the change in the list and in Activity", async () => {
    const owner = await newUser();
    const coordinator = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, coordinator.id, "COORDINATOR");
    signedIn = owner;
    const stored = await addMaria(eventId);

    signedIn = coordinator;
    const loaded = await getAttendeeForEditing(eventId, stored.id);
    expect(loaded).toMatchObject({ ok: true, attendee: { name: "Maria Santos", plusOnes: 2 } });
    const version = stored.updatedAt.toISOString();

    expect(
      await save(eventId, stored.id, {
        ...edited,
        name: "Maria S. Lim",
        email: "maria.lim@example.com",
        phone: "+63 917 000 0000",
        category: "Friends",
        dietaryNeeds: "None",
        version,
      }),
    ).toEqual({ redirect: `/events/${eventId}/attendees?saved=ATT-0001` });

    expect(await getEventAttendees(eventId)).toMatchObject({
      ok: true,
      attendees: [
        {
          name: "Maria S. Lim",
          email: "maria.lim@example.com",
          phone: "+63 917 000 0000",
          category: "Friends",
          rsvpStatus: "DECLINED",
          plusOnes: 0,
          dietaryNeeds: "None",
          notes: "Can't make it",
        },
      ],
    });

    const activity = await getEventActivity(eventId);
    if (!activity.ok) throw new Error("activity refused");
    const entry = activity.entries.find((e) => e.action === "attendee.updated");
    expect(entry && describeAuditEntry(entry)).toEqual({
      summary: "Edited the attendee ATT-0001",
      lines: [
        "Name: “Maria Santos” → “Maria S. Lim”",
        "RSVP: Confirmed → Declined",
        "Plus-ones: 2 → 0",
        "Category: “Family” → “Friends”",
        "Email changed",
        "Phone changed",
        "Dietary needs changed",
        "Notes changed",
      ],
    });
    expect(JSON.stringify(activity.entries)).not.toMatch(/maria\.lim@|000 0000|Can't make it/);
    expect(entry?.actorName).toBe("Mika");
  });

  it("refuses a Viewer: no form, no save", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, viewer.id, "VIEWER");
    signedIn = owner;
    const stored = await addMaria(eventId);

    signedIn = viewer;
    expect(await getAttendeeForEditing(eventId, stored.id)).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(
      await save(eventId, stored.id, { ...edited, version: stored.updatedAt.toISOString() }),
    ).toMatchObject({ message: ATTENDEE_MESSAGES.forbidden });
    expect((await db.attendee.findUniqueOrThrow({ where: { id: stored.id } })).rsvpStatus).toBe(
      "CONFIRMED",
    );
  });

  it("keeps changes with the correct event: another event's attendee can't be edited through this one", async () => {
    const owner = await newUser();
    const eventA = await newEvent(owner.id);
    const eventB = await newEvent(owner.id);
    signedIn = owner;
    const inB = await addMaria(eventB);

    expect(await getAttendeeForEditing(eventA, inB.id)).toEqual({ ok: false, reason: "not-found" });
    expect(
      await save(eventA, inB.id, { ...edited, version: inB.updatedAt.toISOString() }),
    ).toMatchObject({ message: ATTENDEE_MESSAGES.attendeeNotFound });
    const after = await db.attendee.findUniqueOrThrow({ where: { id: inB.id } });
    expect(after).toMatchObject({ eventId: eventB, rsvpStatus: "CONFIRMED" });
  });

  it("a non-member gets 'not available' and changes nothing", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const stored = await addMaria(eventId);

    signedIn = stranger;
    expect(
      await save(eventId, stored.id, { ...edited, version: stored.updatedAt.toISOString() }),
    ).toMatchObject({ message: ATTENDEE_MESSAGES.eventNotFound });
    expect((await db.attendee.findUniqueOrThrow({ where: { id: stored.id } })).notes).toBe(
      "Seat near the stage",
    );
  });

  it("refuses invalid data and a stale save, and records nothing for no changes", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const stored = await addMaria(eventId);
    const version = stored.updatedAt.toISOString();

    expect(await save(eventId, stored.id, { ...edited, plusOnes: "11", version })).toMatchObject({
      fieldErrors: { plusOnes: expect.any(String) },
    });
    expect(await save(eventId, stored.id, { ...maria, version })).toEqual({
      status: "success",
      message: ATTENDEE_MESSAGES.unchanged,
    });
    expect(await save(eventId, stored.id, { ...edited, version })).toMatchObject({
      redirect: expect.stringContaining("saved=ATT-0001"),
    });
    expect(
      await save(eventId, stored.id, { ...edited, name: "Second edit", version }),
    ).toMatchObject({ message: ATTENDEE_MESSAGES.stale });

    const entries = await db.auditLog.count({ where: { eventId, action: "attendee.updated" } });
    expect(entries).toBe(1);
    expect((await db.attendee.findUniqueOrThrow({ where: { id: stored.id } })).name).toBe(
      "Maria Santos",
    );
  });

  it("editing or removing plus-ones changes the expected headcount (B2-05, D-046)", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const stored = await addMaria(eventId); // Confirmed with 2 plus-ones
    const headcount = async () => {
      const list = await getEventAttendees(eventId);
      if (!list.ok) throw new Error("list refused");
      return expectedHeadcount(list.attendees).total;
    };
    expect(await headcount()).toBe(3);

    let version = stored.updatedAt.toISOString();
    await save(eventId, stored.id, { ...maria, plusOnes: "5", version });
    expect(await headcount()).toBe(6);

    version = (
      await db.attendee.findUniqueOrThrow({ where: { id: stored.id } })
    ).updatedAt.toISOString();
    await save(eventId, stored.id, { ...maria, plusOnes: "0", version });
    expect(await headcount()).toBe(1);
    expect((await db.attendee.findUniqueOrThrow({ where: { id: stored.id } })).plusOnes).toBe(0);

    version = (
      await db.attendee.findUniqueOrThrow({ where: { id: stored.id } })
    ).updatedAt.toISOString();
    await save(eventId, stored.id, { ...maria, plusOnes: "3", rsvpStatus: "DECLINED", version });
    expect(await headcount()).toBe(0);
  });
});