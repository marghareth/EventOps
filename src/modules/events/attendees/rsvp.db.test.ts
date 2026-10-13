// src/modules/events/attendees/rsvp.db.test.ts
// RSVP changes end to end (B2-08, D-049): every change between the four states saves through the
// real server action, is recorded in Activity, and moves the expected headcount as D-046 says.
// Saving the same state records nothing; invalid states and refused roles change nothing. Only the
// signed-in identity is mocked.
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
const { expectedHeadcount } = await import("./headcount");
const { RSVP_STATUSES, RSVP_LABEL } = await import("./schema");
const { ATTENDEE_MESSAGES, initialAttendeeFormState } = await import("./form-state");

const YEAR = 2095;
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

const stored = (eventId: string) => db.attendee.findFirstOrThrow({ where: { eventId } });

/** Saves Maria's form again with a new RSVP, as the signed-in user. */
async function saveRsvp(eventId: string, attendeeId: string, rsvpStatus: string) {
  const current = await db.attendee.findUniqueOrThrow({ where: { id: attendeeId } });
  return save(eventId, attendeeId, {
    ...maria,
    rsvpStatus,
    plusOnes: String(current.plusOnes),
    version: current.updatedAt.toISOString(),
  });
}

async function headcount(eventId: string) {
  const result = await getEventAttendees(eventId);
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return expectedHeadcount(result.attendees).total;
}

async function rsvpLines(eventId: string) {
  const activity = await getEventActivity(eventId);
  if (!activity.ok) throw new Error("activity refused");
  return activity.entries
    .filter((e) => e.action === "attendee.updated")
    .flatMap((e) => describeAuditEntry(e).lines)
    .filter((line) => line.startsWith("RSVP:"));
}

/** Every ordered pair of different states: 12 changes. */
const changes = RSVP_STATUSES.flatMap((from) =>
  RSVP_STATUSES.filter((to) => to !== from).map((to) => [from, to] as const),
);

describe("changing RSVP (any state to any other, D-049)", () => {
  it.each(changes)("%s → %s saves, is recorded, and moves the headcount", async (from, to) => {
    const owner = await newUser();
    const coordinator = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, coordinator.id, "COORDINATOR");
    signedIn = owner;
    await submit(eventId, { ...maria, rsvpStatus: from }); // Maria brings 2 plus-ones.
    const id = (await stored(eventId)).id;
    expect(await headcount(eventId)).toBe(from === "CONFIRMED" ? 3 : 0);

    signedIn = coordinator;
    expect(await saveRsvp(eventId, id, to)).toEqual({
      redirect: `/events/${eventId}/attendees?saved=ATT-0001`,
    });
    expect((await stored(eventId)).rsvpStatus).toBe(to);
    expect(await rsvpLines(eventId)).toEqual([`RSVP: ${RSVP_LABEL[from]} → ${RSVP_LABEL[to]}`]);
    // D-046: only Confirmed counts, as 1 + plus-ones.
    expect(await headcount(eventId)).toBe(to === "CONFIRMED" ? 3 : 0);
  });

  it("saving the same state records nothing", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventId, maria);
    const before = await stored(eventId);

    expect(await saveRsvp(eventId, before.id, "CONFIRMED")).toMatchObject({
      message: ATTENDEE_MESSAGES.unchanged,
    });
    expect((await stored(eventId)).updatedAt).toEqual(before.updatedAt);
    expect(await rsvpLines(eventId)).toEqual([]);
  });

  it.each(["ATTENDING", "confirmed", "NULL", "CONFIRMED'; --"])(
    "refuses the state %j and changes nothing",
    async (state) => {
      const owner = await newUser();
      const eventId = await newEvent(owner.id);
      signedIn = owner;
      await submit(eventId, { ...maria, rsvpStatus: "CONFIRMED" });
      const before = await stored(eventId);

      expect(await saveRsvp(eventId, before.id, state)).toMatchObject({
        fieldErrors: { rsvpStatus: "Choose an RSVP status." },
      });
      expect((await stored(eventId)).rsvpStatus).toBe("CONFIRMED");
      expect(await rsvpLines(eventId)).toEqual([]);
    },
  );

  it("treats an empty value as the default, Pending (D-042), as the shared form schema does", async () => {
    // The form's select never sends an empty value; this records today's behavior for a crafted
    // request. Reported in the B2-08 completion report for a decision.
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventId, { ...maria, rsvpStatus: "CONFIRMED" });

    await saveRsvp(eventId, (await stored(eventId)).id, "");
    expect((await stored(eventId)).rsvpStatus).toBe("PENDING");
    expect(await rsvpLines(eventId)).toEqual(["RSVP: Confirmed → Pending"]);
  });
});

describe("who can change RSVP", () => {
  it("refuses a Viewer and a non-member, changing nothing", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const stranger = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, viewer.id, "VIEWER");
    signedIn = owner;
    await submit(eventId, { ...maria, rsvpStatus: "PENDING" });
    const id = (await stored(eventId)).id;

    signedIn = viewer;
    expect(await saveRsvp(eventId, id, "CONFIRMED")).toMatchObject({
      message: ATTENDEE_MESSAGES.forbidden,
    });
    signedIn = stranger;
    expect(await saveRsvp(eventId, id, "CONFIRMED")).toMatchObject({
      message: ATTENDEE_MESSAGES.eventNotFound,
    });
    expect((await stored(eventId)).rsvpStatus).toBe("PENDING");
  });

  it("refuses another event's attendee through this event, even for an Owner of both", async () => {
    const owner = await newUser();
    const eventA = await newEvent(owner.id);
    const eventB = await newEvent(owner.id);
    signedIn = owner;
    await submit(eventB, { ...maria, rsvpStatus: "PENDING" });
    const inB = await stored(eventB);

    expect(await saveRsvp(eventA, inB.id, "CONFIRMED")).toMatchObject({
      message: ATTENDEE_MESSAGES.attendeeNotFound,
    });
    expect((await stored(eventB)).rsvpStatus).toBe("PENDING");
  });
});