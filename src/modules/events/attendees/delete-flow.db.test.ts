// src/modules/events/attendees/delete-flow.db.test.ts
// Removing an attendee end to end (B2-04): the real server action, authorization, PostgreSQL, the
// guest list, the edit page read and the Activity feed. Only the signed-in identity is mocked.
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
const { createAttendeeAction, deleteAttendeeAction } = await import("./actions");
const { getAttendeeForEditing, getEventAttendees } = await import("./read");
const { ATTENDEE_MESSAGES, initialAttendeeFormState } = await import("./form-state");

const YEAR = 2090;
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

/** Adds a guest as the signed-in user and returns the stored record. */
async function addGuest(eventId: string, name = "Maria Santos") {
  await submit(eventId, { ...maria, name });
  return db.attendee.findFirstOrThrow({ where: { eventId, name } });
}

/** Confirms removal as the signed-in user: the action's answer, or its redirect. */
async function confirmRemove(eventId: string, attendeeId: string) {
  try {
    return await deleteAttendeeAction(eventId, attendeeId);
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirect: url };
    throw error;
  }
}

const exists = async (id: string) => (await db.attendee.count({ where: { id } })) === 1;

describe("removing an attendee", () => {
  it.each(["OWNER", "COORDINATOR"] as const)(
    "a %s removes a guest: gone from the list and the edit page, and recorded in Activity",
    async (role) => {
      const owner = await newUser();
      const remover = role === "OWNER" ? owner : await newUser();
      const eventId = await newEvent(owner.id);
      if (role !== "OWNER") await join(eventId, remover.id, role);
      signedIn = owner;
      const guest = await addGuest(eventId);
      await addGuest(eventId, "Ben Lim");

      signedIn = remover;
      expect(await confirmRemove(eventId, guest.id)).toEqual({
        redirect: `/events/${eventId}/attendees?removed=ATT-0001`,
      });
      expect(await exists(guest.id)).toBe(false);

      const list = await getEventAttendees(eventId);
      expect(list.ok && list.attendees.map((a) => a.name)).toEqual(["Ben Lim"]);
      expect(await getAttendeeForEditing(eventId, guest.id)).toEqual({
        ok: false,
        reason: "not-found",
      });

      const activity = await getEventActivity(eventId);
      if (!activity.ok) throw new Error("activity refused");
      const entry = activity.entries.find((e) => e.action === "attendee.deleted");
      expect(entry && describeAuditEntry(entry).summary).toBe(
        "Removed the attendee Maria Santos (ATT-0001)",
      );
      expect(JSON.stringify(entry)).not.toMatch(/example\.com|0917|Vegetarian|stage/);
    },
  );

  it("refuses a Viewer, a non-member and a signed-out visitor; the guest stays", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const stranger = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, viewer.id, "VIEWER");
    signedIn = owner;
    const guest = await addGuest(eventId);

    signedIn = viewer;
    expect(await confirmRemove(eventId, guest.id)).toMatchObject({
      message: ATTENDEE_MESSAGES.forbidden,
    });
    signedIn = stranger;
    expect(await confirmRemove(eventId, guest.id)).toMatchObject({
      message: ATTENDEE_MESSAGES.eventNotFound,
    });
    signedIn = null;
    await expect(deleteAttendeeAction(eventId, guest.id)).rejects.toMatchObject({
      url: expect.stringContaining("/login"),
    });

    expect(await exists(guest.id)).toBe(true);
    expect(await db.auditLog.count({ where: { eventId, action: "attendee.deleted" } })).toBe(0);
  });

  it("can't remove another event's attendee through this event, even as Owner of both", async () => {
    const owner = await newUser();
    const eventA = await newEvent(owner.id);
    const eventB = await newEvent(owner.id);
    signedIn = owner;
    const inB = await addGuest(eventB);

    expect(await confirmRemove(eventA, inB.id)).toMatchObject({
      message: ATTENDEE_MESSAGES.attendeeNotFound,
    });
    expect(await exists(inB.id)).toBe(true);
  });

  it("a member whose role was lowered while the dialog was open removes nothing", async () => {
    const owner = await newUser();
    const coordinator = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, coordinator.id, "COORDINATOR");
    signedIn = owner;
    const guest = await addGuest(eventId);

    await db.eventMember.update({
      where: { eventId_userId: { eventId, userId: coordinator.id } },
      data: { role: "VIEWER" },
    });
    signedIn = coordinator;
    expect(await confirmRemove(eventId, guest.id)).toMatchObject({
      message: ATTENDEE_MESSAGES.forbidden,
    });
    expect(await exists(guest.id)).toBe(true);
  });

  it("a second removal says not available, and numbers are not reused", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const guest = await addGuest(eventId);

    expect(await confirmRemove(eventId, guest.id)).toMatchObject({ redirect: expect.any(String) });
    expect(await confirmRemove(eventId, guest.id)).toMatchObject({
      message: ATTENDEE_MESSAGES.attendeeNotFound,
    });
    expect(await submit(eventId, { ...maria, name: "Next guest" })).toEqual({
      redirect: `/events/${eventId}/attendees?added=ATT-0002`,
    });
    expect(await db.auditLog.count({ where: { eventId, action: "attendee.deleted" } })).toBe(1);
  });
});