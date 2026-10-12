// src/modules/events/lifecycle.db.test.ts
// B1-14: the whole event lifecycle as one story, through the real server code (server actions, page
// access checks, API routes, audit log) and PostgreSQL. Only "who is signed in" is mocked; there is
// no real Supabase account in tests. Each run creates its own users and removes everything it made,
// so it is repeatable. Run with `npm run test:db`.
//
//   Sign in → Create → Listed → Open → Edit → Activity → Roles change → Authorization → Delete → Gone
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

type User = { id: string; email: string; name: string };
let signedIn: User | null = null;
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
const { createEventAction, deleteEventAction, updateEventAction } = await import("./actions");
const { requireEventAccess } = await import("./access");
const { getEventActivity } = await import("./activity");
const { getMyEvents } = await import("./queries");
const { toEventFormValues } = await import("./schema");
const forms = await import("./form-state");
const listRoute = await import("@/app/api/events/route");
const eventRoute = await import("@/app/api/events/[eventId]/route");

const users: Record<"ana" | "ben" | "cara" | "dan", User> = {
  ana: { id: randomUUID(), email: "", name: "Ana (Owner)" },
  ben: { id: randomUUID(), email: "", name: "Ben (Coordinator)" },
  cara: { id: randomUUID(), email: "", name: "Cara (Viewer)" },
  dan: { id: randomUUID(), email: "", name: "Dan (outsider)" },
};
for (const user of Object.values(users)) user.email = `${user.id}@example.test`;

let eventId = "";
let reference = "";

const signIn = (user: User | null) => {
  signedIn = user;
};

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

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** Edit through the real server action, changing the given fields. */
async function edit(changes: Record<string, string>) {
  const current = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  const data = form({
    ...toEventFormValues(current),
    version: current.updatedAt.toISOString(),
    ...changes,
  });
  return run(updateEventAction(eventId, forms.initialEditEventState, data));
}

const remove = () =>
  run(deleteEventAction(eventId, forms.initialDeleteEventState, form({ confirmation: reference })));

async function apiGet(path: string, params?: { eventId: string }) {
  const request = new Request(`http://localhost${path}`);
  return params ? eventRoute.GET(request, { params: Promise.resolve(params) }) : listRoute.GET();
}

const listedNames = async (user: User) => {
  const events = await getMyEvents(user.id);
  return events.map((event) => event.id);
};

beforeAll(async () => {
  db = createPrismaClient(url);
  await db.user.createMany({
    data: Object.values(users).map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.name,
    })),
  });
});

afterAll(async () => {
  const ids = Object.values(users).map((user) => user.id);
  await db.event.deleteMany({ where: { createdById: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

// Tests in a file run in order, one at a time; each step builds on the previous one.
describe("event lifecycle (B1-14)", () => {
  it("1. Ana signs in and creates an event, landing on its workspace", async () => {
    signIn(users.ana);
    const result = await run(
      createEventAction(
        forms.initialCreateEventState,
        form({
          name: "Lifecycle Gala",
          date: "2099-12-12",
          startTime: "16:00",
          endTime: "22:00",
          venue: "Cebu",
          description: "",
          capacity: "200",
          expectedAttendees: "180",
        }),
      ),
    );
    const match = /^\/events\/([0-9a-f-]{36})\?created=(EVT-\d{4}-\d{4,})$/.exec(
      (result as { redirect: string }).redirect,
    );
    expect(match).not.toBeNull();
    [, eventId, reference] = match!;
  });

  it("2. the event appears in Ana's event list and API, and nobody else's", async () => {
    expect(await listedNames(users.ana)).toContain(eventId);
    for (const other of [users.ben, users.cara, users.dan]) {
      expect(await listedNames(other)).not.toContain(eventId);
    }
    signIn(users.ana);
    const response = await apiGet("/api/events");
    expect((await response.json()).events.map((event: { id: string }) => event.id)).toContain(
      eventId,
    );
  });

  it("3. Ana opens the event as its Owner", async () => {
    signIn(users.ana);
    expect((await requireEventAccess(eventId)).access).toMatchObject({
      kind: "ok",
      event: { id: eventId, reference, name: "Lifecycle Gala", role: "OWNER" },
    });
    const response = await apiGet(`/api/events/${eventId}`, { eventId });
    expect(response.status).toBe(200);
  });

  it("4. Ana edits the event and the change persists", async () => {
    signIn(users.ana);
    expect(await edit({ venue: "Manila", expectedAttendees: "220" })).toMatchObject({
      status: "success",
    });
    expect(await db.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({
      venue: "Manila",
      expectedAttendees: 220,
    });
  });

  it("5. activity is generated and Ana sees it, newest first", async () => {
    signIn(users.ana);
    const activity = await getEventActivity(eventId);
    expect(activity.ok).toBe(true);
    if (!activity.ok) return;
    expect(activity.entries.map((entry) => [entry.action, entry.actorName])).toEqual([
      ["event.updated", "Ana (Owner)"],
      ["event.created", "Ana (Owner)"],
    ]);
    expect(activity.entries[0].details).toEqual({
      changes: {
        venue: { from: "Cebu", to: "Manila" },
        expectedAttendees: { from: 180, to: 220 },
      },
    });
  });

  it("6. member context changes: Ben joins as Coordinator, Cara as Viewer", async () => {
    // There is no member management screen yet (D-034), so the Owner's decision is applied directly.
    await db.eventMember.createMany({
      data: [
        { eventId, userId: users.ben.id, role: "COORDINATOR" },
        { eventId, userId: users.cara.id, role: "VIEWER" },
      ],
    });
    expect(await listedNames(users.ben)).toContain(eventId);
    expect(await listedNames(users.cara)).toContain(eventId);
  });

  it("7. Dan, who is not a member, is refused everywhere, as if the event didn't exist", async () => {
    signIn(users.dan);
    expect(await run(requireEventAccess(eventId))).toEqual({ notFound: true });
    expect((await apiGet(`/api/events/${eventId}`, { eventId })).status).toBe(404);
    expect(await edit({ venue: "Hijacked" })).toMatchObject({
      message: forms.EDIT_EVENT_MESSAGES.notFound,
    });
    expect(await remove()).toMatchObject({ message: forms.DELETE_EVENT_MESSAGES.notFound });
    expect(await getEventActivity(eventId)).toEqual({ ok: false, reason: "not-found" });
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).venue).toBe("Manila");
  });

  it("8. Cara, a Viewer, can read the event but every write fails", async () => {
    signIn(users.cara);
    expect((await requireEventAccess(eventId)).access).toMatchObject({
      event: { role: "VIEWER" },
    });
    expect((await apiGet(`/api/events/${eventId}`, { eventId })).status).toBe(200);
    expect(await edit({ venue: "Viewer change" })).toMatchObject({
      message: forms.EDIT_EVENT_MESSAGES.forbidden,
    });
    expect(await remove()).toMatchObject({ message: forms.DELETE_EVENT_MESSAGES.forbidden });
    expect(await getEventActivity(eventId)).toEqual({ ok: false, reason: "forbidden" });
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).venue).toBe("Manila");
  });

  it("9. Ben, a Coordinator, can edit and see activity but cannot delete", async () => {
    signIn(users.ben);
    expect(await edit({ capacity: "250" })).toMatchObject({ status: "success" });
    const activity = await getEventActivity(eventId);
    expect(activity.ok && activity.entries[0]).toMatchObject({
      action: "event.updated",
      actorName: "Ben (Coordinator)",
    });
    expect(await remove()).toMatchObject({ message: forms.DELETE_EVENT_MESSAGES.forbidden });
    expect(await db.event.count({ where: { id: eventId } })).toBe(1);
  });

  it("10. role changes take effect at once: Ben demoted to Viewer, Cara promoted to Coordinator", async () => {
    await db.eventMember.update({
      where: { eventId_userId: { eventId, userId: users.ben.id } },
      data: { role: "VIEWER" },
    });
    await db.eventMember.update({
      where: { eventId_userId: { eventId, userId: users.cara.id } },
      data: { role: "COORDINATOR" },
    });
    signIn(users.ben);
    expect(await edit({ venue: "Ben again" })).toMatchObject({
      message: forms.EDIT_EVENT_MESSAGES.forbidden,
    });
    signIn(users.cara);
    expect(await edit({ venue: "Iloilo" })).toMatchObject({ status: "success" });
    expect(await remove()).toMatchObject({ message: forms.DELETE_EVENT_MESSAGES.forbidden });
  });

  it("11. Ana, the Owner, deletes the event and returns to her event list", async () => {
    signIn(users.ana);
    expect(await remove()).toEqual({
      redirect: `/events?deleted=${encodeURIComponent(reference)}`,
    });
  });

  it("12. the event disappears everywhere, with its members and activity", async () => {
    for (const user of Object.values(users)) {
      expect(await listedNames(user)).not.toContain(eventId);
    }
    signIn(users.ana);
    expect(await run(requireEventAccess(eventId))).toEqual({ notFound: true });
    expect((await apiGet(`/api/events/${eventId}`, { eventId })).status).toBe(404);
    expect(await getEventActivity(eventId)).toEqual({ ok: false, reason: "not-found" });
    expect(await db.eventMember.count({ where: { eventId } })).toBe(0);
    expect(await db.auditLog.count({ where: { eventId } })).toBe(0);
    // People are not deleted with an event.
    expect(
      await db.user.count({ where: { id: { in: Object.values(users).map((u) => u.id) } } }),
    ).toBe(4);
  });
});