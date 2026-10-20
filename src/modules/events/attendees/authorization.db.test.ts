// src/modules/events/attendees/authorization.db.test.ts
// Attendee security checkpoint (B2-20). One matrix: every actor tries every attendee operation
// through the real server actions, reads and API route (the way a crafted request would, with no
// page in between), against PostgreSQL. Allowed operations succeed; denied ones fail and change
// nothing in either event, and add nothing to Activity. Runs in CI (the "db" job).
//
//   User A ── Event A ── Attendee A → allowed
//          └─ Event B ── Attendee B → denied
//   Viewer of A      → reads allowed; writes, import and export denied (D-035)
//   Coordinator of A → every attendee operation allowed
//   Signed out       → everything denied
// Import moved to the import context in Batch 9 (D-109); its own matrix is in
// import/import.db.test.ts ("who can import").
//
// Only the signed-in identity is mocked.
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
const { getAttendeeDetails, getAttendeeForEditing, getEventAttendees } = await import("./read");
const { updateAttendeeAction, deleteAttendeeAction } = await import("./actions");
const { GET: exportRoute } = await import("@/app/api/events/[eventId]/attendees/export/route");
const { initialAttendeeFormState } = await import("./form-state");

const YEAR = 2099;
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

type User = { id: string; email: string };
type World = {
  userA: User;
  userB: User;
  coordinator: User;
  viewer: User;
  eventA: string;
  eventB: string;
  attendeeA: string;
  attendeeB: string;
};

/** Event A (User A, with a Coordinator and a Viewer) and Event B (User B), one attendee each. */
async function world(): Promise<World> {
  const userA = await newUser();
  const userB = await newUser();
  const coordinator = await newUser();
  const viewer = await newUser();
  const eventA = await newEvent(userA.id);
  const eventB = await newEvent(userB.id);
  await join(eventA, coordinator.id, "COORDINATOR");
  await join(eventA, viewer.id, "VIEWER");
  signedIn = userA;
  await submit(eventA, { name: "Attendee A", email: "a@example.com", notes: "Private A" });
  signedIn = userB;
  await submit(eventB, { name: "Attendee B", email: "b@example.com", notes: "Private B" });
  signedIn = null;
  const id = async (eventId: string) =>
    (await db.attendee.findFirstOrThrow({ where: { eventId } })).id;
  return {
    userA,
    userB,
    coordinator,
    viewer,
    eventA,
    eventB,
    attendeeA: await id(eventA),
    attendeeB: await id(eventB),
  };
}

/** Everything an operation could change, in both events. */
async function snapshot(w: World) {
  const where = { eventId: { in: [w.eventA, w.eventB] } };
  return {
    attendees: await db.attendee.findMany({ where, orderBy: { id: "asc" } }),
    audit: await db.auditLog.count({ where }),
    counters: await db.event.findMany({
      where: { id: { in: [w.eventA, w.eventB] } },
      select: { id: true, lastAttendeeNumber: true },
      orderBy: { id: "asc" },
    }),
  };
}

type Outcome = "allowed" | "denied";

/** Server actions redirect when they succeed; a redirect to sign-in is a refusal. */
async function action(run: () => Promise<unknown>): Promise<Outcome> {
  try {
    const result = (await run()) as { redirect?: string; step?: string };
    return result?.step === "done" ? "allowed" : "denied";
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url && !url.startsWith("/login")) return "allowed";
    if (url) return "denied";
    throw error;
  }
}

const read = async (run: () => Promise<{ ok: boolean }>): Promise<Outcome> => {
  try {
    return (await run()).ok ? "allowed" : "denied";
  } catch (error) {
    if ((error as { url?: string }).url?.startsWith("/login")) return "denied";
    throw error;
  }
};

const version = async (attendeeId: string) =>
  (await db.attendee.findUnique({ where: { id: attendeeId } }))?.updatedAt.toISOString() ??
  new Date().toISOString();

/** Every attendee operation, aimed at an event and an attendee chosen by the caller. */
const OPERATIONS = {
  "read the guest list": (eventId: string) => read(() => getEventAttendees(eventId)),
  "read attendee details": (eventId: string, attendeeId: string) =>
    read(() => getAttendeeDetails(eventId, attendeeId)),
  "open the edit form": (eventId: string, attendeeId: string) =>
    read(() => getAttendeeForEditing(eventId, attendeeId)),
  "create an attendee": (eventId: string) =>
    action(() =>
      createAttendeeAction(eventId, initialAttendeeFormState, form({ name: "Intruder" })),
    ),
  "edit an attendee": async (eventId: string, attendeeId: string) => {
    const v = await version(attendeeId);
    return action(() =>
      updateAttendeeAction(
        eventId,
        attendeeId,
        initialAttendeeFormState,
        form({ name: "Changed", version: v }),
      ),
    );
  },
  "change an RSVP": async (eventId: string, attendeeId: string) => {
    const v = await version(attendeeId);
    return action(() =>
      updateAttendeeAction(
        eventId,
        attendeeId,
        initialAttendeeFormState,
        form({
          name: "Attendee A",
          email: "a@example.com",
          notes: "Private A",
          rsvpStatus: "DECLINED",
          version: v,
        }),
      ),
    );
  },
  "delete an attendee": (eventId: string, attendeeId: string) =>
    action(() => deleteAttendeeAction(eventId, attendeeId)),
  "export the guest list": async (eventId: string) => {
    const response = await exportRoute(
      new Request(`http://localhost/api/events/${eventId}/attendees/export`),
      {
        params: Promise.resolve({ eventId }),
      },
    );
    return response.status === 200 ? "allowed" : "denied";
  },
} satisfies Record<string, (eventId: string, attendeeId: string) => Promise<Outcome>>;

type Operation = keyof typeof OPERATIONS;
const ALL = Object.keys(OPERATIONS) as Operation[];
const READS: Operation[] = ["read the guest list", "read attendee details"];

/** Who acts, and on which event and attendee. */
const ACTORS: {
  name: string;
  as: (w: World) => User | null;
  target: (w: World) => [string, string];
  allowed: Operation[];
}[] = [
  {
    name: "User A on Event A",
    as: (w) => w.userA,
    target: (w) => [w.eventA, w.attendeeA],
    allowed: ALL,
  },
  {
    name: "Coordinator of A on Event A",
    as: (w) => w.coordinator,
    target: (w) => [w.eventA, w.attendeeA],
    allowed: ALL,
  },
  {
    name: "Viewer of A on Event A",
    as: (w) => w.viewer,
    target: (w) => [w.eventA, w.attendeeA],
    allowed: READS,
  },
  {
    name: "User A on Event B",
    as: (w) => w.userA,
    target: (w) => [w.eventB, w.attendeeB],
    allowed: [],
  },
  // Event A in the address, Event B's attendee in the request: the attendee is never found.
  {
    name: "User A on Event A with Attendee B",
    as: (w) => w.userA,
    target: (w) => [w.eventA, w.attendeeB],
    allowed: ["read the guest list", "create an attendee", "export the guest list"],
  },
  {
    name: "Signed out on Event A",
    as: () => null,
    target: (w) => [w.eventA, w.attendeeA],
    allowed: [],
  },
];

describe.each(ACTORS)("$name", ({ as, target, allowed }) => {
  it.each(ALL)("%s", async (operation) => {
    const w = await world();
    const expected: Outcome = allowed.includes(operation) ? "allowed" : "denied";
    const before = await snapshot(w);
    signedIn = as(w);
    const [eventId, attendeeId] = target(w);

    expect(await OPERATIONS[operation](eventId, attendeeId)).toBe(expected);

    const after = await snapshot(w);
    if (expected === "denied") {
      expect(after).toEqual(before);
    } else {
      // An allowed operation changes only the event in the address.
      const other = eventId === w.eventA ? w.eventB : w.eventA;
      expect(after.attendees.filter((a) => a.eventId === other)).toEqual(
        before.attendees.filter((a) => a.eventId === other),
      );
    }
  });
});

describe("what a refused or cross-event caller can learn", () => {
  it("never receives another event's attendee data, in any response", async () => {
    const w = await world();
    signedIn = w.userA;
    const responses = [
      await getEventAttendees(w.eventB),
      await getAttendeeDetails(w.eventB, w.attendeeB),
      await getAttendeeDetails(w.eventA, w.attendeeB),
      await getAttendeeForEditing(w.eventA, w.attendeeB),
      await deleteAttendeeAction(w.eventA, w.attendeeB),
      await (
        await exportRoute(new Request("http://x"), {
          params: Promise.resolve({ eventId: w.eventB }),
        })
      ).text(),
    ];
    expect(JSON.stringify(responses)).not.toMatch(/Attendee B|b@example\.com|Private B/);
  });

  it("gives a Viewer no contact details or notes in any read", async () => {
    const w = await world();
    signedIn = w.viewer;
    const responses = [
      await getEventAttendees(w.eventA),
      await getAttendeeDetails(w.eventA, w.attendeeA),
    ];
    expect(JSON.stringify(responses)).toContain("Attendee A");
    expect(JSON.stringify(responses)).not.toMatch(/a@example\.com|Private A/);
  });
});