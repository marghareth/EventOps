// src/modules/events/attendees/export.db.test.ts
// CSV export end to end (B2-19, D-053): the real route handler, authorization, PostgreSQL and
// Activity. Only the authorized event's attendees are exported, Viewers and non-members get
// nothing, and every successful export is recorded. Only the signed-in identity is mocked.
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
const { GET } = await import("@/app/api/events/[eventId]/attendees/export/route");
const { parseCsv } = await import("./csv");
const { getEventActivity } = await import("../activity");
const { describeAuditEntry } = await import("@/modules/events/audit/public");
const { initialAttendeeFormState } = await import("./form-state");

const YEAR = 2098;
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

async function download(eventId: string) {
  const response = await GET(
    new Request(`http://localhost/api/events/${eventId}/attendees/export`),
    {
      params: Promise.resolve({ eventId }),
    },
  );
  // Decode by hand, keeping the byte-order mark (Response.text() drops it).
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { response, bytes, text: new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes) };
}

function rows(text: string) {
  const parsed = parseCsv(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.table.rows.map((r) => r.cells);
}

const exportsRecorded = (eventId: string) =>
  db.auditLog.count({ where: { eventId, action: "attendees.exported" } });

describe("exporting the guest list", () => {
  it("gives an Owner or Coordinator this event's attendees as a CSV download, and records it", async () => {
    const owner = await newUser();
    const coordinator = await newUser();
    const eventId = await newEvent(owner.id);
    const otherEvent = await newEvent(owner.id);
    await join(eventId, coordinator.id, "COORDINATOR");
    signedIn = owner;
    await submit(eventId, {
      name: "Ana Reyes",
      email: "ana@example.com",
      rsvpStatus: "CONFIRMED",
      plusOnes: "1",
      notes: "Line one\nLine two",
    });
    await submit(eventId, { name: "=cmd|' /C calc'!A0", phone: "+63 917 123 4567" });
    await submit(otherEvent, { name: "Only In Other Event" });

    for (const user of [owner, coordinator]) {
      signedIn = user;
      const { response, text } = await download(eventId);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      expect(response.headers.get("content-disposition")).toMatch(
        /^attachment; filename="EVT-2098-\d{4}-attendees-\d{4}-\d{2}-\d{2}\.csv"$/,
      );
      expect(response.headers.get("cache-control")).toMatch(/no-store/);
      expect(rows(text)).toEqual([
        [
          "ATT-0001",
          "Ana Reyes",
          "Confirmed",
          "1",
          "",
          "",
          "ana@example.com",
          "",
          "Line one\nLine two",
        ],
        ["ATT-0002", "'=cmd|' /C calc'!A0", "Pending", "0", "", "", "", "'+63 917 123 4567", ""],
      ]);
      expect(text).not.toContain("Only In Other Event");
    }

    expect(await exportsRecorded(eventId)).toBe(2);
    const activity = await getEventActivity(eventId);
    if (!activity.ok) throw new Error("activity refused");
    const entry = activity.entries.find((e) => e.action === "attendees.exported");
    expect(entry && describeAuditEntry(entry).summary).toBe(
      "Exported the guest list as CSV (2 attendees)",
    );
  });

  it("exports only the header for an empty guest list", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const { response, bytes, text } = await download(eventId);
    expect(response.status).toBe(200);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(text).toBe("\uFEFFID,Name,RSVP,Plus-ones,Category,Dietary needs,Email,Phone,Notes\r\n");
  });

  it("refuses a Viewer (403), a non-member and an unknown event (404) and signed-out users (401), recording nothing", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, viewer.id, "VIEWER");
    signedIn = owner;
    await submit(eventId, { name: "Ana Reyes", email: "ana@example.com" });

    const attempts: [{ id: string; email: string } | null, string, number][] = [
      [viewer, eventId, 403],
      [await newUser(), eventId, 404],
      [owner, "00000000-0000-4000-8000-000000000000", 404],
      [owner, "not-an-id", 404],
      [null, eventId, 401],
    ];
    for (const [user, id, status] of attempts) {
      signedIn = user;
      const { response, text } = await download(id);
      expect(response.status, `${user?.id ?? "signed out"} → ${id}`).toBe(status);
      expect(response.headers.get("content-type")).toMatch(/application\/json/);
      expect(text).not.toContain("Ana Reyes");
      expect(text).not.toContain("ana@example.com");
    }
    expect(await exportsRecorded(eventId)).toBe(0);
  });

  it("can't be pointed at another event the user doesn't belong to", async () => {
    const owner = await newUser();
    const stranger = await newUser();
    const theirs = await newEvent(stranger.id);
    signedIn = stranger;
    await submit(theirs, { name: "Private Guest" });

    signedIn = owner;
    const { response, text } = await download(theirs);
    expect(response.status).toBe(404);
    expect(text).not.toContain("Private Guest");
  });
});