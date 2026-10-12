// src/modules/events/authorization.db.test.ts
// The required B1-09 security test, end to end against a real database (D-036). Only the signed-in
// identity is mocked; membership, roles and every write go through the real server actions, the
// real API route, the real page access check and PostgreSQL. Run with `npm run test:db`.
//
//   User A → Event A                → allowed
//   User A → Event B                → denied
//   User B → Event A                → denied
//   Viewer → protected write         → denied
//   Coordinator → Owner-only action  → denied
//   Owner → Owner operation          → allowed
//
// Plus cross-event and role-escalation attempts.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

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
const { createEvent } = await import("./create-event");
const { deleteEventAction, updateEventAction } = await import("./actions");
const { requireEventAccess } = await import("./access");
const { getEventActivity } = await import("./activity");
const { toEventFormValues } = await import("./schema");
const {
  DELETE_EVENT_MESSAGES,
  EDIT_EVENT_MESSAGES,
  initialDeleteEventState,
  initialEditEventState,
} = await import("./form-state");
const { GET } = await import("@/app/api/events/[eventId]/route");

const YEAR = 2097;
const userIds: string[] = [];

async function newUser(name: string) {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: name } });
  return { id, email: `${id}@example.test` };
}

async function newEvent(ownerId: string, name: string) {
  const { id } = await createEvent(db, {
    event: {
      name,
      venue: "Cebu",
      description: null,
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      endsAt: null,
      capacity: null,
      expectedAttendees: 100,
    },
    creatorId: ownerId,
    now: new Date(`${YEAR}-01-01T00:00:00Z`),
  });
  return id;
}

let userA: { id: string; email: string };
let userB: { id: string; email: string };
let coordinator: { id: string; email: string };
let viewer: { id: string; email: string };
let eventA: string;
let eventB: string;

const as = (user: { id: string; email: string } | null) => {
  signedIn = user;
};

const read = (eventId: string) => db.event.findUnique({ where: { id: eventId } });

/** Calls a server action, returning its state or the redirect/not-found it threw. */
async function run<T>(call: Promise<T>): Promise<T | { redirect: string } | { notFound: true }> {
  try {
    return await call;
  } catch (error) {
    const thrown = error as { url?: string; notFound?: boolean };
    if (thrown.url) return { redirect: thrown.url };
    if (thrown.notFound) return { notFound: true };
    throw error;
  }
}

/** Edit through the real server action, changing the venue; extra fields are sent as given. */
async function edit(eventId: string, extra: Record<string, string> = {}) {
  const current = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  const data = new FormData();
  for (const [key, value] of Object.entries(toEventFormValues(current))) data.set(key, value);
  data.set("venue", "Changed venue");
  data.set("version", current.updatedAt.toISOString());
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return run(updateEventAction(eventId, initialEditEventState, data));
}

async function remove(eventId: string, extra: Record<string, string> = {}) {
  const current = await db.event.findUnique({ where: { id: eventId } });
  const data = new FormData();
  data.set("confirmation", current?.reference ?? "EVT-0000-0000");
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return run(deleteEventAction(eventId, initialDeleteEventState, data));
}

async function api(eventId: string) {
  return GET(new Request(`http://localhost/api/events/${eventId}`), {
    params: Promise.resolve({ eventId }),
  });
}

beforeAll(() => {
  db = createPrismaClient(url);
});
beforeEach(async () => {
  userA = await newUser("User A");
  userB = await newUser("User B");
  coordinator = await newUser("Coordinator");
  viewer = await newUser("Viewer");
  eventA = await newEvent(userA.id, "Event A");
  eventB = await newEvent(userB.id, "Event B");
  await db.eventMember.createMany({
    data: [
      { eventId: eventA, userId: coordinator.id, role: "COORDINATOR" },
      { eventId: eventA, userId: viewer.id, role: "VIEWER" },
    ],
  });
});
afterEach(async () => {
  signedIn = null;
  await db.event.deleteMany({ where: { createdById: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  await db.eventReferenceCounter.deleteMany({ where: { year: YEAR } });
});
afterAll(async () => {
  await db.$disconnect();
});

describe("required security test (B1-09)", () => {
  it("User A → Event A → allowed (page, API and a write)", async () => {
    as(userA);
    expect((await requireEventAccess(eventA)).access).toMatchObject({
      kind: "ok",
      event: { id: eventA, role: "OWNER" },
    });
    const response = await api(eventA);
    expect(response.status).toBe(200);
    expect((await response.json()).event).toMatchObject({ id: eventA, role: "OWNER" });
    expect(await edit(eventA)).toMatchObject({ status: "success" });
    expect((await read(eventA))?.venue).toBe("Changed venue");
  });

  it("User A → Event B → denied (page, API, edit and delete), and nothing changes", async () => {
    as(userA);
    expect(await run(requireEventAccess(eventB))).toEqual({ notFound: true });
    expect((await api(eventB)).status).toBe(404);
    expect(await edit(eventB)).toMatchObject({ message: EDIT_EVENT_MESSAGES.notFound });
    expect(await remove(eventB)).toMatchObject({ message: DELETE_EVENT_MESSAGES.notFound });
    expect(await read(eventB)).toMatchObject({ name: "Event B", venue: "Cebu" });
  });

  it("User B → Event A → denied, and nothing changes", async () => {
    as(userB);
    expect(await run(requireEventAccess(eventA))).toEqual({ notFound: true });
    expect((await api(eventA)).status).toBe(404);
    expect(await edit(eventA)).toMatchObject({ message: EDIT_EVENT_MESSAGES.notFound });
    expect(await remove(eventA)).toMatchObject({ message: DELETE_EVENT_MESSAGES.notFound });
    expect(await read(eventA)).toMatchObject({ name: "Event A", venue: "Cebu" });
  });

  it("Viewer → protected write → denied (can still read)", async () => {
    as(viewer);
    expect((await api(eventA)).status).toBe(200);
    // Refused by the role check itself (not only by the database re-check behind it).
    expect(await edit(eventA)).toMatchObject({ message: EDIT_EVENT_MESSAGES.forbidden });
    expect(await remove(eventA)).toMatchObject({ message: DELETE_EVENT_MESSAGES.forbidden });
    expect(await read(eventA)).toMatchObject({ venue: "Cebu" });
  });

  it("Coordinator → Owner-only operation → denied (but may edit)", async () => {
    as(coordinator);
    expect(await remove(eventA)).toMatchObject({ message: DELETE_EVENT_MESSAGES.forbidden });
    expect(await read(eventA)).not.toBeNull();
    expect(await edit(eventA)).toMatchObject({ status: "success" });
  });

  it("Owner → Owner operation → allowed", async () => {
    as(userA);
    expect(await remove(eventA)).toMatchObject({
      redirect: expect.stringMatching(/^\/events\?deleted=/),
    });
    expect(await read(eventA)).toBeNull();
    expect(await read(eventB)).not.toBeNull();
  });

  it("signed out → every operation is refused before touching the event", async () => {
    as(null);
    expect((await api(eventA)).status).toBe(401);
    expect(await edit(eventA)).toMatchObject({ redirect: expect.stringMatching(/^\/login/) });
    expect(await remove(eventA)).toMatchObject({ redirect: expect.stringMatching(/^\/login/) });
    expect(await read(eventA)).toMatchObject({ venue: "Cebu" });
  });
});

describe("cross-event access", () => {
  it("another user's event looks exactly like an event that does not exist", async () => {
    as(userA);
    const other = await api(eventB);
    const missing = await api(randomUUID());
    expect([other.status, await other.json()]).toEqual([missing.status, await missing.json()]);
  });

  it("a Coordinator of Event A gets nothing from Event B", async () => {
    as(coordinator);
    expect((await api(eventB)).status).toBe(404);
    expect(await edit(eventB)).toMatchObject({ status: "error" });
    expect(await read(eventB)).toMatchObject({ venue: "Cebu" });
  });

  it.each(["not-a-uuid", "' OR 1=1 --", `${randomUUID()}/../x`])(
    "a malformed event ID (%j) is refused",
    async (badId) => {
      as(userA);
      expect((await api(badId)).status).toBe(404);
      expect(await edit(badId).catch(() => ({ status: "error" }))).toMatchObject({
        status: "error",
      });
    },
  );
});

describe("role escalation attempts", () => {
  it("a Viewer cannot gain rights by sending a role, user or owner in the form", async () => {
    as(viewer);
    const forged = { role: "OWNER", userId: userA.id, createdById: viewer.id, eventId: eventB };
    expect(await edit(eventA, forged)).toMatchObject({ message: EDIT_EVENT_MESSAGES.forbidden });
    expect(await remove(eventA, forged)).toMatchObject({
      message: DELETE_EVENT_MESSAGES.forbidden,
    });
    expect(await read(eventA)).toMatchObject({ venue: "Cebu", createdById: userA.id });
    expect(
      await db.eventMember.findUniqueOrThrow({
        where: { eventId_userId: { eventId: eventA, userId: viewer.id } },
      }),
    ).toMatchObject({ role: "VIEWER" });
  });

  it("a Coordinator cannot delete by sending role=OWNER", async () => {
    as(coordinator);
    expect(await remove(eventA, { role: "OWNER" })).toMatchObject({
      message: DELETE_EVENT_MESSAGES.forbidden,
    });
    expect(await read(eventA)).not.toBeNull();
  });

  it("an Owner's edit form cannot change the creator, status or reference", async () => {
    as(userA);
    const before = await read(eventA);
    await edit(eventA, { createdById: userB.id, status: "CANCELLED", reference: "EVT-1999-0001" });
    expect(await read(eventA)).toMatchObject({
      createdById: before?.createdById,
      status: before?.status,
      reference: before?.reference,
    });
  });

  it("a member demoted to Viewer after opening the form cannot save it", async () => {
    as(coordinator);
    const current = await db.event.findUniqueOrThrow({ where: { id: eventA } });
    const data = new FormData();
    for (const [key, value] of Object.entries(toEventFormValues(current))) data.set(key, value);
    data.set("venue", "Late change");
    data.set("version", current.updatedAt.toISOString());
    await db.eventMember.update({
      where: { eventId_userId: { eventId: eventA, userId: coordinator.id } },
      data: { role: "VIEWER" },
    });
    expect(await run(updateEventAction(eventA, initialEditEventState, data))).toMatchObject({
      status: "error",
    });
    expect(await read(eventA)).toMatchObject({ venue: "Cebu" });
  });

  it("a removed member's open form cannot save, and the API stops answering", async () => {
    as(coordinator);
    await db.eventMember.delete({
      where: { eventId_userId: { eventId: eventA, userId: coordinator.id } },
    });
    expect(await edit(eventA)).toMatchObject({ status: "error" });
    expect((await api(eventA)).status).toBe(404);
    expect(await read(eventA)).toMatchObject({ venue: "Cebu" });
  });
});

describe("audit access is authorization-protected (B1-11, audit.view)", () => {
  it.each([
    ["the Owner", () => userA],
    ["a Coordinator", () => coordinator],
  ])("%s can read the activity", async (_label, who) => {
    as(who());
    const activity = await getEventActivity(eventA);
    expect(activity.ok).toBe(true);
    if (activity.ok)
      expect(activity.entries.map((entry) => entry.action)).toContain("event.created");
  });

  it("a Viewer is refused", async () => {
    as(viewer);
    expect(await getEventActivity(eventA)).toEqual({ ok: false, reason: "forbidden" });
  });

  it("another event's owner gets the same answer as for an unknown event", async () => {
    as(userB);
    expect(await getEventActivity(eventA)).toEqual({ ok: false, reason: "not-found" });
    expect(await getEventActivity(randomUUID())).toEqual({ ok: false, reason: "not-found" });
  });

  it("signed out is sent to sign in", async () => {
    as(null);
    expect(await run(getEventActivity(eventA))).toMatchObject({
      redirect: expect.stringMatching(/^\/login/),
    });
  });

  it("each user's edits are recorded under their own name, in their own event only", async () => {
    as(coordinator);
    await edit(eventA);
    as(userA);
    const activity = await getEventActivity(eventA);
    expect(activity.ok && activity.entries[0]).toMatchObject({
      action: "event.updated",
      actorName: "Coordinator",
    });
    expect(await db.auditLog.count({ where: { eventId: eventB, action: "event.updated" } })).toBe(
      0,
    );
  });
});