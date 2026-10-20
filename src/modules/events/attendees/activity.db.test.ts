// src/modules/events/attendees/activity.db.test.ts
// Attendee Activity (B2-21, D-037): every meaningful attendee action leaves one readable entry, in
// order, and no entry stores contact details, dietary needs or notes. Runs every action through
// the real server actions and route against PostgreSQL. Only the signed-in identity is mocked.
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
const { updateAttendeeAction, deleteAttendeeAction } = await import("./actions");
// The import wizard lives in the import context (B9, D-109) and has its own end-to-end tests;
// here the attendees' own import use case is called, as the wizard does after authorizing.
const { importAttendees } = await import("./import-attendees");
const { GET: exportRoute } = await import("@/app/api/events/[eventId]/attendees/export/route");
const { getEventActivity } = await import("../activity");
const { describeAuditEntry } = await import("@/modules/events/audit/public");
const { initialAttendeeFormState } = await import("./form-state");

const YEAR = 2088;
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

const SECRETS = {
  email: "maria.secret@example.com",
  phone: "0917 555 0101",
  dietary: "Severe peanut allergy",
  notes: "Recovering from surgery",
  newNotes: "Uses a wheelchair today",
};

describe("attendee activity (B2-21)", () => {
  it("records create, edit, RSVP change, import, export and delete, in order, without personal data", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;

    await submit(eventId, {
      name: "Maria Santos",
      email: SECRETS.email,
      phone: SECRETS.phone,
      dietaryNeeds: SECRETS.dietary,
      notes: SECRETS.notes,
    });
    const maria = await db.attendee.findFirstOrThrow({ where: { eventId } });
    const save = async (fields: Record<string, string>) => {
      const current = await db.attendee.findUniqueOrThrow({ where: { id: maria.id } });
      const base = {
        name: current.name,
        email: SECRETS.email,
        phone: SECRETS.phone,
        dietaryNeeds: SECRETS.dietary,
        notes: current.notes ?? "",
        rsvpStatus: current.rsvpStatus,
        plusOnes: String(current.plusOnes),
      };
      await action(() =>
        updateAttendeeAction(
          eventId,
          maria.id,
          initialAttendeeFormState,
          form({ ...base, ...fields, version: current.updatedAt.toISOString() }),
        ),
      );
    };
    await save({ name: "Maria S. Lim", notes: SECRETS.newNotes, plusOnes: "2" });
    await save({ rsvpStatus: "CONFIRMED" });
    await importAttendees(db, {
      eventId,
      importerId: owner.id,
      attendees: [
        {
          name: "Ben Lim",
          email: "ben.secret@example.com",
          phone: null,
          rsvpStatus: "PENDING",
          plusOnes: 0,
          category: null,
          dietaryNeeds: null,
          notes: null,
        },
      ],
      skipped: 0,
    });
    await exportRoute(new Request("http://x"), { params: Promise.resolve({ eventId }) });
    await action(() => deleteAttendeeAction(eventId, maria.id));

    const activity = await getEventActivity(eventId);
    if (!activity.ok) throw new Error("activity refused");
    // Newest first in the feed; read it oldest first. The event's own "created" entry comes first.
    const described = [...activity.entries].reverse().map((e) => describeAuditEntry(e));
    expect(described.slice(1)).toEqual([
      { summary: "Added the attendee Maria Santos (ATT-0001)", lines: [] },
      {
        summary: "Edited the attendee ATT-0001",
        lines: ["Name: “Maria Santos” → “Maria S. Lim”", "Plus-ones: 0 → 2", "Notes changed"],
      },
      { summary: "Edited the attendee ATT-0001", lines: ["RSVP: Pending → Confirmed"] },
      { summary: "Imported 1 attendee from a CSV file (ATT-0002)", lines: [] },
      { summary: "Exported the guest list as CSV (2 attendees)", lines: [] },
      { summary: "Removed the attendee Maria S. Lim (ATT-0001)", lines: [] },
    ]);

    // Nothing personal is stored in any entry, read straight from the table.
    const stored = JSON.stringify(await db.auditLog.findMany({ where: { eventId } }));
    for (const secret of [...Object.values(SECRETS), "ben.secret@example.com"]) {
      expect(stored).not.toContain(secret);
    }
  });

  it("records nothing for refused actions or saves that change nothing", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, viewer.id, "VIEWER");
    signedIn = owner;
    await submit(eventId, { name: "Maria Santos" });
    const maria = await db.attendee.findFirstOrThrow({ where: { eventId } });
    const before = await db.auditLog.count({ where: { eventId } });

    // A save with no change.
    await action(() =>
      updateAttendeeAction(
        eventId,
        maria.id,
        initialAttendeeFormState,
        form({ name: "Maria Santos", version: maria.updatedAt.toISOString() }),
      ),
    );
    // Refused: a Viewer's edit, delete, import and export.
    signedIn = viewer;
    await action(() =>
      updateAttendeeAction(
        eventId,
        maria.id,
        initialAttendeeFormState,
        form({ name: "X", version: maria.updatedAt.toISOString() }),
      ),
    );
    await action(() => deleteAttendeeAction(eventId, maria.id));
    expect(
      await importAttendees(db, {
        eventId,
        importerId: viewer.id,
        attendees: [
          {
            name: "X",
            email: null,
            phone: null,
            rsvpStatus: "PENDING",
            plusOnes: 0,
            category: null,
            dietaryNeeds: null,
            notes: null,
          },
        ],
        skipped: 0,
      }),
    ).toEqual({ ok: false });
    await exportRoute(new Request("http://x"), { params: Promise.resolve({ eventId }) });

    expect(await db.auditLog.count({ where: { eventId } })).toBe(before);
  });
});