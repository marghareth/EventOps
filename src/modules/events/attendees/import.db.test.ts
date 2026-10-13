// src/modules/events/attendees/import.db.test.ts
// CSV import end to end (B2-14 to B2-18, D-052): the real server action at every step, the import
// rules, PostgreSQL and Activity. Checks that nothing is written before confirm, that only this
// event receives the attendees, that the import is all or nothing, that tampered steps are caught,
// and that refused roles change nothing. Only the signed-in identity is mocked.
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
const { importStepAction } = await import("./import-actions");
const { IMPORT_MESSAGES, initialImportState } = await import("./import-state");
const { getEventActivity } = await import("../activity");
const { describeAuditEntry } = await import("@/modules/events/audit/public");
const { initialAttendeeFormState } = await import("./form-state");

const YEAR = 2097;
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

type State = Awaited<ReturnType<typeof importStepAction>>;

const FILE = [
  "Guest Name,Email,RSVP,Plus ones,Table",
  "Ana Reyes,ana@example.com,Yes,1,T1",
  "Ben Lim,not-an-email,Maybe,0,T2",
  "José Peña,,No,,T3",
  "Carla Santos,carla@example.com,,2,T4",
].join("\n");

const csvFile = (text: string, name = "guests.csv", type = "text/csv") =>
  new File([text], name, { type });

async function step(eventId: string, fields: Record<string, string | File>): Promise<State> {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return importStepAction(eventId, initialImportState, data);
}

/** Upload, then preview with the suggested mapping. */
async function toPreview(eventId: string, text = FILE, extra: Record<string, string> = {}) {
  const mapped = await step(eventId, { intent: "upload", file: csvFile(text) });
  if (mapped.step !== "map") throw new Error(`upload failed: ${JSON.stringify(mapped)}`);
  const carry: Record<string, string> = { csv: mapped.csv, fileName: mapped.fileName };
  mapped.mapping.forEach((field, i) => (carry[`map-${i}`] = field ?? ""));
  const preview = await step(eventId, { ...carry, intent: "preview", ...extra });
  return { carry, preview };
}

const attendeeCount = (eventId: string) => db.attendee.count({ where: { eventId } });

describe("before confirming", () => {
  it("uploads, suggests a mapping and previews, writing nothing", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const auditBefore = await db.auditLog.count({ where: { eventId } });

    const { preview } = await toPreview(eventId);
    if (preview.step !== "preview") throw new Error("no preview");
    expect(preview.mapping).toEqual(["name", "email", "rsvpStatus", "plusOnes", null]);
    expect(preview.preview.totals).toEqual({
      rows: 4,
      valid: 3,
      invalid: 1,
      duplicates: 0,
      toImport: 3,
    });
    expect(preview.preview.rows.find((r) => r.line === 3)?.errors).toEqual([
      "Email: Enter an email like name@example.com.",
    ]);
    // The parsed attendees stay on the server.
    expect(JSON.stringify(preview)).not.toContain('"attendee"');

    expect(await attendeeCount(eventId)).toBe(0);
    expect(await db.auditLog.count({ where: { eventId } })).toBe(auditBefore);
  });

  it.each([
    ["no file", { intent: "upload" }, IMPORT_MESSAGES.noFile],
    [
      "a .xlsx file",
      {
        intent: "upload",
        file: csvFile(
          "x",
          "guests.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      },
      IMPORT_MESSAGES.notCsv,
    ],
    [
      "a .csv name with an image type",
      { intent: "upload", file: csvFile("x", "guests.csv", "image/png") },
      IMPORT_MESSAGES.notCsv,
    ],
    [
      "a file over 500 KB",
      { intent: "upload", file: csvFile(`Name\n${"a,".repeat(260_000)}`) },
      IMPORT_MESSAGES.tooLarge,
    ],
    [
      "text that isn't UTF-8",
      {
        intent: "upload",
        file: new File([new Uint8Array([0x4e, 0x61, 0x6d, 0x65, 0x0a, 0xff, 0xfe])], "g.csv", {
          type: "text/csv",
        }),
      },
      IMPORT_MESSAGES.notUtf8,
    ],
  ])("refuses %s", async (_label, fields, message) => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    expect(await step(eventId, fields as Record<string, string | File>)).toEqual({
      step: "upload",
      error: message,
    });
  });

  it("refuses a malformed file with the reason", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    expect(await step(eventId, { intent: "upload", file: csvFile('Name\n"Ana') })).toEqual({
      step: "upload",
      error:
        'guests.csv: A quoted value that starts on line 2 never ends. Check for a missing closing quote (").',
    });
  });

  it("returns to the mapping with reasons when the mapping is wrong", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const { carry } = await toPreview(eventId);
    const result = await step(eventId, {
      ...carry,
      "map-0": "",
      "map-1": "email",
      "map-2": "email",
      "map-4": "salary",
      intent: "preview",
    });
    expect(result).toMatchObject({
      step: "map",
      mapping: [null, "email", "email", "plusOnes", null],
      errors: [
        "A column is mapped to a field EventOps doesn't have. Choose a listed field or Don't import.",
        "Email is chosen for more than one column. Choose it once.",
        "Choose the column that holds each guest's name.",
      ],
    });
  });
});

describe("confirming", () => {
  it("imports the valid rows into this event in one go, numbered after existing attendees, and records it", async () => {
    const owner = await newUser();
    const coordinator = await newUser();
    const eventId = await newEvent(owner.id);
    const otherEvent = await newEvent(owner.id);
    await join(eventId, coordinator.id, "COORDINATOR");
    signedIn = owner;
    await submit(eventId, { name: "Existing Guest" });

    signedIn = coordinator;
    const { carry } = await toPreview(eventId);
    const done = await step(eventId, { ...carry, intent: "confirm", expected: "3" });
    expect(done).toEqual({
      step: "done",
      count: 3,
      first: "ATT-0002",
      last: "ATT-0004",
      skipped: 1,
    });

    const rows = await db.attendee.findMany({ where: { eventId }, orderBy: { number: "asc" } });
    expect(rows.map((r) => [r.number, r.name, r.rsvpStatus, r.plusOnes, r.email])).toEqual([
      [1, "Existing Guest", "PENDING", 0, null],
      [2, "Ana Reyes", "CONFIRMED", 1, "ana@example.com"],
      [3, "José Peña", "DECLINED", 0, null],
      [4, "Carla Santos", "PENDING", 2, "carla@example.com"],
    ]);
    expect(await attendeeCount(otherEvent)).toBe(0);

    const activity = await getEventActivity(eventId);
    if (!activity.ok) throw new Error("activity refused");
    const entry = activity.entries.find((e) => e.action === "attendees.imported");
    expect(entry && describeAuditEntry(entry)).toEqual({
      summary: "Imported 3 attendees from a CSV file (ATT-0002 to ATT-0004)",
      lines: ["1 row not imported"],
    });
    expect(JSON.stringify(entry)).not.toMatch(/Ana|Peña|example\.com/);

    // The next attendee added by hand continues the numbering.
    await submit(eventId, { name: "After Import" });
    expect(
      (await db.attendee.findFirstOrThrow({ where: { eventId, name: "After Import" } })).number,
    ).toBe(5);
  });

  it("skips duplicates unless chosen, so importing the same file twice doesn't double the list", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const first = await toPreview(eventId);
    await step(eventId, { ...first.carry, intent: "confirm", expected: "3" });

    const again = await toPreview(eventId);
    if (again.preview.step !== "preview") throw new Error("no preview");
    expect(again.preview.preview.totals).toMatchObject({ valid: 0, duplicates: 3, toImport: 0 });
    expect(await step(eventId, { ...again.carry, intent: "confirm", expected: "0" })).toMatchObject(
      {
        step: "preview",
        message: IMPORT_MESSAGES.nothingToImport,
      },
    );
    expect(await attendeeCount(eventId)).toBe(3);

    expect(
      await step(eventId, {
        ...again.carry,
        intent: "confirm",
        expected: "3",
        includeDuplicates: "on",
      }),
    ).toMatchObject({ step: "done", count: 3 });
    expect(await attendeeCount(eventId)).toBe(6);
  });

  it("refuses to import when the numbers no longer match what the user saw", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const { carry } = await toPreview(eventId);
    // Someone adds Ana by hand after the preview: she is now a duplicate.
    await submit(eventId, { name: "Ana Reyes", email: "ana@example.com" });
    expect(await step(eventId, { ...carry, intent: "confirm", expected: "3" })).toMatchObject({
      step: "preview",
      message: IMPORT_MESSAGES.changed,
      preview: { totals: { valid: 2, duplicates: 1, toImport: 2 } },
    });
    expect(await attendeeCount(eventId)).toBe(1);
  });

  it("re-checks the file text at confirm: rows edited in the browser can't slip in invalid data", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const { carry } = await toPreview(eventId);
    const tampered = carry.csv.replace(
      "Ana Reyes,ana@example.com,Yes,1",
      "Ana Reyes,ana@example.com,Yes,99",
    );
    const result = await step(eventId, {
      ...carry,
      csv: tampered,
      intent: "confirm",
      expected: "3",
    });
    expect(result).toMatchObject({
      step: "preview",
      message: IMPORT_MESSAGES.changed,
      preview: { totals: { invalid: 2, toImport: 2 } },
    });
    expect(await attendeeCount(eventId)).toBe(0);
    // A file text that grew past the limit in the browser is refused too.
    expect(
      await step(eventId, {
        ...carry,
        csv: `${carry.csv}\n${"x".repeat(520_000)}`,
        intent: "confirm",
        expected: "3",
      }),
    ).toEqual({
      step: "upload",
      error: IMPORT_MESSAGES.tooLarge,
    });
  });

  it("is all or nothing: a failure while writing saves no attendee, number or Activity entry", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const { carry } = await toPreview(eventId);
    const counterBefore = (await db.event.findUniqueOrThrow({ where: { id: eventId } }))
      .lastAttendeeNumber;
    // Force the database to refuse one row (a NOT blank name check).
    await db.$executeRawUnsafe(
      `ALTER TABLE attendees ADD CONSTRAINT import_test_no_pena CHECK (name <> 'José Peña') NOT VALID`,
    );
    try {
      expect(await step(eventId, { ...carry, intent: "confirm", expected: "3" })).toMatchObject({
        step: "preview",
        message: IMPORT_MESSAGES.failed,
      });
    } finally {
      await db.$executeRawUnsafe(`ALTER TABLE attendees DROP CONSTRAINT import_test_no_pena`);
    }
    expect(await attendeeCount(eventId)).toBe(0);
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).lastAttendeeNumber).toBe(
      counterBefore,
    );
    expect(await db.auditLog.count({ where: { eventId, action: "attendees.imported" } })).toBe(0);
  });
});

describe("who can import (import.run)", () => {
  it("refuses a Viewer and a non-member at every step, changing nothing", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, viewer.id, "VIEWER");
    signedIn = owner;
    const { carry } = await toPreview(eventId);

    signedIn = viewer;
    const steps: Record<string, string | File>[] = [
      { intent: "upload", file: csvFile(FILE) },
      { ...carry, intent: "preview" },
      { ...carry, intent: "confirm", expected: "3" },
    ];
    for (const fields of steps) {
      expect(await step(eventId, fields)).toEqual({
        step: "upload",
        error: IMPORT_MESSAGES.forbidden,
      });
    }
    signedIn = await newUser();
    expect(await step(eventId, { ...carry, intent: "confirm", expected: "3" })).toEqual({
      step: "upload",
      error: IMPORT_MESSAGES.eventNotFound,
    });
    signedIn = null;
    await expect(
      step(eventId, { ...carry, intent: "confirm", expected: "3" }),
    ).rejects.toMatchObject({
      url: expect.stringContaining("/login"),
    });
    expect(await attendeeCount(eventId)).toBe(0);
  });

  it("imports only into the event in the address, even for an Owner of two events", async () => {
    const owner = await newUser();
    const eventA = await newEvent(owner.id);
    const eventB = await newEvent(owner.id);
    signedIn = owner;
    const { carry } = await toPreview(eventA);
    await step(eventB, { ...carry, intent: "confirm", expected: "3" });
    expect(await attendeeCount(eventA)).toBe(0);
    expect(await attendeeCount(eventB)).toBe(3);
  });
});