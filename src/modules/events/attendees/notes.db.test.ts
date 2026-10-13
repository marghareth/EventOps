// src/modules/events/attendees/notes.db.test.ts
// Attendee notes end to end (B2-07, D-048): created, edited and cleared through the real server
// actions, kept with the right attendee, shown on the details page only to roles with
// attendees.private, and never to anyone outside the event or in Activity. Only the signed-in
// identity is mocked.
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
const { getAttendeeDetails } = await import("./read");
const { ATTENDEE_MESSAGES, initialAttendeeFormState } = await import("./form-state");

const YEAR = 2094;
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

async function save(eventId: string, attendeeId: string, fields: Record<string, string>) {
  try {
    return await updateAttendeeAction(eventId, attendeeId, initialAttendeeFormState, form(fields));
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirect: url };
    throw error;
  }
}

const stored = (eventId: string, name = "Maria Santos") =>
  db.attendee.findFirstOrThrow({ where: { eventId, name } });

/** Saves Maria's form again with new notes, as the signed-in user. */
async function saveNotes(eventId: string, attendeeId: string, notes: string) {
  const current = await db.attendee.findUniqueOrThrow({ where: { id: attendeeId } });
  return save(eventId, attendeeId, { ...maria, notes, version: current.updatedAt.toISOString() });
}

/** The details page's read, as the signed-in user. */
const details = (eventId: string, attendeeId: string) => getAttendeeDetails(eventId, attendeeId);

describe("creating, editing and clearing notes", () => {
  it("creates notes with line breaks, edits them, and removes them by clearing the field", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;

    await submit(eventId, { ...maria, notes: "Bringing his kids.\nNeeds two high chairs." });
    const maria1 = await stored(eventId);
    expect(maria1.notes).toBe("Bringing his kids.\nNeeds two high chairs.");
    expect(await details(eventId, maria1.id)).toMatchObject({
      ok: true,
      attendee: { notes: "Bringing his kids.\nNeeds two high chairs." },
    });

    expect(await saveNotes(eventId, maria1.id, "Arrives at 5 PM")).toEqual({
      redirect: `/events/${eventId}/attendees?saved=ATT-0001`,
    });
    expect((await stored(eventId)).notes).toBe("Arrives at 5 PM");

    await saveNotes(eventId, maria1.id, "  ");
    expect((await stored(eventId)).notes).toBeNull();
    expect(await details(eventId, maria1.id)).toMatchObject({
      ok: true,
      attendee: { notes: null },
    });
  });

  it("keeps notes with the right attendee and event", async () => {
    const owner = await newUser();
    const eventA = await newEvent(owner.id);
    const eventB = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventA, maria);
    await submit(eventA, { name: "Ben Lim", notes: "Plays the guitar" });
    await submit(eventB, { ...maria, notes: "Other event" });

    await saveNotes(eventA, (await stored(eventA)).id, "Changed in A");

    expect((await stored(eventA)).notes).toBe("Changed in A");
    expect((await stored(eventA, "Ben Lim")).notes).toBe("Plays the guitar");
    expect((await stored(eventB)).notes).toBe("Other event");
  });

  it("never writes notes into Activity, only that they changed", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventId, { ...maria, notes: "Recovering from surgery" });
    await saveNotes(eventId, (await stored(eventId)).id, "Uses a cane");

    const activity = await getEventActivity(eventId);
    if (!activity.ok) throw new Error("activity refused");
    expect(JSON.stringify(activity.entries)).not.toMatch(/surgery|cane/i);
    const entry = activity.entries.find((e) => e.action === "attendee.updated");
    expect(entry && describeAuditEntry(entry).lines).toEqual(["Notes changed"]);
  });
});

describe("who sees notes (attendees.private, D-048)", () => {
  it("Owners and Coordinators get contact details and notes on the details page", async () => {
    const owner = await newUser();
    const coordinator = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, coordinator.id, "COORDINATOR");
    signedIn = owner;
    await submit(eventId, maria);
    const id = (await stored(eventId)).id;

    for (const user of [owner, coordinator]) {
      signedIn = user;
      expect(await details(eventId, id)).toEqual({
        ok: true,
        fields: { dietaryNeeds: true, private: true },
        attendee: {
          id,
          number: 1,
          name: "Maria Santos",
          rsvpStatus: "CONFIRMED",
          plusOnes: 2,
          category: "Family",
          dietaryNeeds: "Vegetarian",
          email: "maria@example.com",
          phone: "0917 123 4567",
          notes: "Seat near the stage",
        },
      });
    }
  });

  it("a Viewer can open the details page but never receives contact details or notes", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, viewer.id, "VIEWER");
    signedIn = owner;
    await submit(eventId, maria);
    const id = (await stored(eventId)).id;

    signedIn = viewer;
    const result = await details(eventId, id);
    if (!result.ok) throw new Error(`refused: ${result.reason}`);
    expect(result.fields).toEqual({ dietaryNeeds: true, private: false });
    expect(Object.keys(result.attendee).sort()).toEqual(
      ["category", "dietaryNeeds", "id", "name", "number", "plusOnes", "rsvpStatus"].sort(),
    );
    expect(JSON.stringify(result)).not.toMatch(/stage|example\.com|0917/);
  });

  it("a Viewer can't change notes", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, viewer.id, "VIEWER");
    signedIn = owner;
    await submit(eventId, maria);

    signedIn = viewer;
    expect(await saveNotes(eventId, (await stored(eventId)).id, "Changed")).toMatchObject({
      message: ATTENDEE_MESSAGES.forbidden,
    });
    expect((await stored(eventId)).notes).toBe("Seat near the stage");
  });

  it("non-members get not-found; signed-out users are sent to sign in", async () => {
    const owner = await newUser();
    const outsider = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventId, maria);
    const id = (await stored(eventId)).id;

    signedIn = outsider;
    expect(await details(eventId, id)).toEqual({ ok: false, reason: "not-found" });
    expect(await saveNotes(eventId, id, "Changed")).toMatchObject({
      message: ATTENDEE_MESSAGES.eventNotFound,
    });

    signedIn = null;
    await expect(details(eventId, id)).rejects.toMatchObject({
      url: expect.stringContaining("/login"),
    });
    expect((await stored(eventId)).notes).toBe("Seat near the stage");
  });

  it("another event's attendee is not found through this event, even for an Owner of both", async () => {
    const owner = await newUser();
    const eventA = await newEvent(owner.id);
    const eventB = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventB, maria);
    const inB = await stored(eventB);

    expect(await details(eventA, inB.id)).toEqual({ ok: false, reason: "not-found" });
    expect(await saveNotes(eventA, inB.id, "Changed")).toMatchObject({
      message: ATTENDEE_MESSAGES.attendeeNotFound,
    });
    expect((await stored(eventB)).notes).toBe("Seat near the stage");
  });

  it("a removed attendee is not found (B2-13)", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventId, maria);
    const id = (await stored(eventId)).id;
    await db.attendee.delete({ where: { id } });
    expect(await details(eventId, id)).toEqual({ ok: false, reason: "not-found" });
  });
});