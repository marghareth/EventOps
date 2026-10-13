// src/modules/events/attendees/dietary.db.test.ts
// Dietary needs end to end (B2-06, D-047): recorded, edited and removed through the real server
// actions, kept with the right attendee, shown on the guest list to every member, and never to
// anyone outside the event or in Activity. Only the signed-in identity is mocked.
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
const { getEventAttendees } = await import("./read");
const { listGuestList } = await import("./queries");
const { ATTENDEE_MESSAGES, initialAttendeeFormState } = await import("./form-state");

const YEAR = 2093;
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

/** Saves Maria's form again with new dietary needs, as the signed-in user. */
async function saveDietary(eventId: string, attendeeId: string, dietaryNeeds: string) {
  const current = await db.attendee.findUniqueOrThrow({ where: { id: attendeeId } });
  return save(eventId, attendeeId, {
    ...maria,
    dietaryNeeds,
    version: current.updatedAt.toISOString(),
  });
}

/** Maria's dietary needs as the guest list shows them to the signed-in user. */
async function listed(eventId: string) {
  const result = await getEventAttendees(eventId);
  if (!result.ok) throw new Error(`guest list refused: ${result.reason}`);
  return result.attendees.find((a) => a.name === "Maria Santos")?.dietaryNeeds;
}

describe("recording, editing and removing dietary needs", () => {
  it("records several needs in one entry, edits them, and removes them by clearing the field", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;

    await submit(eventId, { ...maria, dietaryNeeds: "  Vegetarian; no nuts; halal " });
    const maria1 = await stored(eventId);
    expect(maria1.dietaryNeeds).toBe("Vegetarian; no nuts; halal");
    expect(await listed(eventId)).toBe("Vegetarian; no nuts; halal");

    expect(await saveDietary(eventId, maria1.id, "Vegan")).toEqual({
      redirect: `/events/${eventId}/attendees?saved=ATT-0001`,
    });
    expect((await stored(eventId)).dietaryNeeds).toBe("Vegan");

    expect(await saveDietary(eventId, maria1.id, "   ")).toEqual({
      redirect: `/events/${eventId}/attendees?saved=ATT-0001`,
    });
    expect((await stored(eventId)).dietaryNeeds).toBeNull();
    expect(await listed(eventId)).toBeNull();
  });

  it("keeps dietary needs with the right attendee and event", async () => {
    const owner = await newUser();
    const eventA = await newEvent(owner.id);
    const eventB = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventA, maria);
    await submit(eventA, { name: "Ben Lim", dietaryNeeds: "No shellfish" });
    await submit(eventB, { ...maria, dietaryNeeds: "Halal" });

    await saveDietary(eventA, (await stored(eventA)).id, "Gluten free");

    expect((await stored(eventA)).dietaryNeeds).toBe("Gluten free");
    expect((await stored(eventA, "Ben Lim")).dietaryNeeds).toBe("No shellfish");
    expect((await stored(eventB)).dietaryNeeds).toBe("Halal");
    expect(await listed(eventB)).toBe("Halal");
  });

  it("refuses to change another event's attendee through this event", async () => {
    const owner = await newUser();
    const eventA = await newEvent(owner.id);
    const eventB = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventB, maria);
    const inB = await stored(eventB);

    // saveDietary reads the version from the stored row, so only the event ID is wrong here.
    expect(await saveDietary(eventA, inB.id, "Changed")).toMatchObject({
      message: ATTENDEE_MESSAGES.attendeeNotFound,
    });
    expect((await stored(eventB)).dietaryNeeds).toBe("Vegetarian");
  });

  it("never writes dietary needs into Activity, only that they changed", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventId, { ...maria, dietaryNeeds: "Peanut allergy" });
    await saveDietary(eventId, (await stored(eventId)).id, "Shellfish allergy");

    const activity = await getEventActivity(eventId);
    if (!activity.ok) throw new Error("activity refused");
    expect(JSON.stringify(activity.entries)).not.toMatch(/allergy/i);
    const entry = activity.entries.find((e) => e.action === "attendee.updated");
    expect(entry && describeAuditEntry(entry).lines).toEqual(["Dietary needs changed"]);
  });
});

describe("who sees dietary needs (attendees.dietary, D-047)", () => {
  it("every member sees them on the guest list, Viewers included", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventId, maria);

    for (const role of ["COORDINATOR", "VIEWER"] as const) {
      const member = await newUser();
      await join(eventId, member.id, role);
      signedIn = member;
      expect(await getEventAttendees(eventId)).toMatchObject({
        ok: true,
        showDietaryNeeds: true,
        attendees: [{ name: "Maria Santos", dietaryNeeds: "Vegetarian" }],
      });
    }
  });

  it("the guest list never loads notes; contact details only for attendees.private (D-050)", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, viewer.id, "VIEWER");
    signedIn = owner;
    await submit(eventId, maria);
    const base = ["category", "dietaryNeeds", "id", "name", "number", "plusOnes", "rsvpStatus"];

    const asOwner = await getEventAttendees(eventId);
    if (!asOwner.ok) throw new Error("refused");
    // Email and phone are loaded so Owners and Coordinators can search by them (B2-10).
    expect(Object.keys(asOwner.attendees[0]).sort()).toEqual([...base, "email", "phone"].sort());

    signedIn = viewer;
    const asViewer = await getEventAttendees(eventId);
    if (!asViewer.ok) throw new Error("refused");
    expect(Object.keys(asViewer.attendees[0]).sort()).toEqual(base.sort());
    expect(JSON.stringify(asViewer)).not.toMatch(/example\.com|0917|stage/);
  });

  it("the query leaves dietary needs out entirely when the reader may not see them", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventId, maria);
    const [row] = await listGuestList(db, eventId, { dietaryNeeds: false, contact: false });
    expect(row).not.toHaveProperty("dietaryNeeds");
    expect(JSON.stringify(row)).not.toMatch(/Vegetarian/);
  });

  it("non-members get not-found and see nothing; signed-out users are sent to sign in", async () => {
    const owner = await newUser();
    const outsider = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventId, maria);

    signedIn = outsider;
    expect(await getEventAttendees(eventId)).toEqual({ ok: false, reason: "not-found" });

    signedIn = null;
    await expect(getEventAttendees(eventId)).rejects.toMatchObject({
      url: expect.stringContaining("/login"),
    });
  });

  it("Viewers can read dietary needs but not change them", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, viewer.id, "VIEWER");
    signedIn = owner;
    await submit(eventId, maria);

    signedIn = viewer;
    expect(await saveDietary(eventId, (await stored(eventId)).id, "Vegan")).toMatchObject({
      message: ATTENDEE_MESSAGES.forbidden,
    });
    expect((await stored(eventId)).dietaryNeeds).toBe("Vegetarian");
  });
});