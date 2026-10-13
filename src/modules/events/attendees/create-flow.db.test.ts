// src/modules/events/attendees/create-flow.db.test.ts
// Adding an attendee end to end (B2-02): the real server action, authorization, validation,
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
const { createAttendeeAction } = await import("./actions");
const { getEventAttendees } = await import("./read");
const { ATTENDEE_MESSAGES, initialAttendeeFormState } = await import("./form-state");

const YEAR = 2092;
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

describe("adding an attendee", () => {
  it("saves to the current event, shows on the guest list, and appears in Activity", async () => {
    const owner = await newUser();
    const coordinator = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, coordinator.id, "COORDINATOR");
    signedIn = coordinator;

    expect(await submit(eventId, maria)).toEqual({
      redirect: `/events/${eventId}/attendees?added=ATT-0001`,
    });

    const list = await getEventAttendees(eventId);
    expect(list).toMatchObject({
      ok: true,
      attendees: [
        {
          number: 1,
          name: "Maria Santos",
          email: "maria@example.com",
          rsvpStatus: "CONFIRMED",
          plusOnes: 2,
          dietaryNeeds: "Vegetarian",
          notes: "Seat near the stage",
        },
      ],
    });

    const activity = await getEventActivity(eventId);
    if (!activity.ok) throw new Error("activity refused");
    const entry = activity.entries.find((e) => e.action === "attendee.created");
    expect(entry && describeAuditEntry(entry).summary).toBe(
      "Added the attendee Maria Santos (ATT-0001)",
    );
  });

  it("refuses a Viewer and saves nothing", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, viewer.id, "VIEWER");
    signedIn = viewer;

    expect(await submit(eventId, maria)).toMatchObject({ message: ATTENDEE_MESSAGES.forbidden });
    expect(await db.attendee.count({ where: { eventId } })).toBe(0);
  });

  it("can't create an attendee in another event: a non-member gets 'not available'", async () => {
    const userA = await newUser();
    const userB = await newUser();
    const eventA = await newEvent(userA.id);
    const eventB = await newEvent(userB.id);
    signedIn = userA;

    expect(await submit(eventB, maria)).toMatchObject({ message: ATTENDEE_MESSAGES.eventNotFound });
    expect(await db.attendee.count({ where: { eventId: { in: [eventA, eventB] } } })).toBe(0);
  });

  it("ignores an event ID sent in the form: the attendee goes to the event in the URL", async () => {
    const owner = await newUser();
    const eventA = await newEvent(owner.id);
    const eventB = await newEvent(owner.id);
    signedIn = owner;

    await submit(eventA, { ...maria, eventId: eventB });
    expect(await db.attendee.count({ where: { eventId: eventA } })).toBe(1);
    expect(await db.attendee.count({ where: { eventId: eventB } })).toBe(0);
  });

  it("refuses invalid data and saves nothing", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;

    expect(await submit(eventId, { ...maria, name: "", plusOnes: "11" })).toMatchObject({
      status: "error",
      fieldErrors: { name: expect.any(String), plusOnes: expect.any(String) },
    });
    expect(await db.attendee.count({ where: { eventId } })).toBe(0);
  });

  it("sends a signed-out visitor to sign in, saving nothing", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    await expect(
      createAttendeeAction(eventId, initialAttendeeFormState, form(maria)),
    ).rejects.toMatchObject({
      url: expect.stringContaining("/login"),
    });
    expect(await db.attendee.count({ where: { eventId } })).toBe(0);
  });
});