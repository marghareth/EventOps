// src/modules/events/attendees/guest-list.db.test.ts
// Search, filters and sorting against PostgreSQL (B2-10, B2-11, B2-12; D-050). They run on the
// guest list the server authorized for the reader, so another event's guests never appear, a Viewer
// can't find anyone by email or phone, and sorting changes nothing stored. Only the signed-in
// identity is mocked.
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
const { createAttendeeAction } = await import("./actions");
const { getEventAttendees } = await import("./read");
const { DEFAULT_QUERY, applyGuestListQuery } = await import("./guest-list-query");
const { initialAttendeeFormState } = await import("./form-state");

const YEAR = 2096;
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

type Query = Partial<typeof DEFAULT_QUERY>;

/** The guest list as the page shows it to the signed-in user, after search, filters and sort. */
async function shown(eventId: string, query: Query) {
  const result = await getEventAttendees(eventId);
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return applyGuestListQuery(result.attendees, { ...DEFAULT_QUERY, ...query }).map((a) => a.name);
}

async function twoEvents() {
  const owner = await newUser();
  const viewer = await newUser();
  const eventA = await newEvent(owner.id);
  const eventB = await newEvent(owner.id);
  await join(eventA, viewer.id, "VIEWER");
  signedIn = owner;
  await submit(eventA, { ...maria, email: "maria@example.com", phone: "0917 123 4567" });
  await submit(eventA, {
    name: "José Peña",
    rsvpStatus: "MAYBE",
    plusOnes: "1",
    category: "Friends",
  });
  await submit(eventA, { name: "Ben Lim", rsvpStatus: "DECLINED", category: "Family" });
  await submit(eventB, { name: "Bea Only-In-B", email: "bea@example.com", category: "Family" });
  return { owner, viewer, eventA, eventB };
}

describe("search (B2-10)", () => {
  it("finds this event's guests by name, accents ignored, and never another event's", async () => {
    const { eventA } = await twoEvents();
    expect(await shown(eventA, { search: "pena" })).toEqual(["José Peña"]);
    expect(await shown(eventA, { search: "Bea" })).toEqual([]);
    expect(await shown(eventA, { search: "bea@example.com" })).toEqual([]);
  });

  it("finds by ID within the event", async () => {
    const { eventA } = await twoEvents();
    expect(await shown(eventA, { search: "ATT-0002" })).toEqual(["José Peña"]);
  });

  it("lets an Owner find by email or phone, but not a Viewer", async () => {
    const { viewer, eventA } = await twoEvents();
    expect(await shown(eventA, { search: "maria@example" })).toEqual(["Maria Santos"]);
    expect(await shown(eventA, { search: "123 4567" })).toEqual(["Maria Santos"]);

    signedIn = viewer;
    expect(await shown(eventA, { search: "maria@example" })).toEqual([]);
    expect(await shown(eventA, { search: "123 4567" })).toEqual([]);
    expect(await shown(eventA, { search: "maria" })).toEqual(["Maria Santos"]);
  });

  it("gives non-members nothing to search", async () => {
    const { eventA } = await twoEvents();
    signedIn = await newUser();
    expect(await getEventAttendees(eventA)).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("filters (B2-11)", () => {
  it("combines filters with AND, inside this event only", async () => {
    const { eventA, eventB } = await twoEvents();
    expect(await shown(eventA, { category: "Family" })).toEqual(["Ben Lim", "Maria Santos"]);
    expect(await shown(eventA, { category: "Family", plusOnes: "yes" })).toEqual(["Maria Santos"]);
    expect(await shown(eventA, { dietary: "yes" })).toEqual(["Maria Santos"]);
    expect(await shown(eventA, { rsvp: "MAYBE", plusOnes: "yes" })).toEqual(["José Peña"]);
    expect(await shown(eventB, { category: "Family" })).toEqual(["Bea Only-In-B"]);
  });
});

describe("sorting (B2-12)", () => {
  it("orders this event's guests and changes nothing stored", async () => {
    const { eventA } = await twoEvents();
    const before = await db.attendee.findMany({ orderBy: { id: "asc" } });
    const audit = await db.auditLog.count({ where: { eventId: eventA } });

    expect(await shown(eventA, { sort: "rsvp" })).toEqual(["Maria Santos", "José Peña", "Ben Lim"]);
    expect(await shown(eventA, { sort: "id", dir: "desc" })).toEqual([
      "Ben Lim",
      "José Peña",
      "Maria Santos",
    ]);
    expect(await shown(eventA, { sort: "plusones", dir: "desc", search: "a" })).toEqual([
      "Maria Santos",
      "José Peña",
    ]);

    expect(await db.attendee.findMany({ orderBy: { id: "asc" } })).toEqual(before);
    expect(await db.auditLog.count({ where: { eventId: eventA } })).toBe(audit);
  });
});