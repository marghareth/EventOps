// src/modules/events/import/import.db.test.ts
// Import end to end (B2-14 to B2-18, D-052; B9-F01 to F20, D-109 to D-112): the real server action
// at every step, the import rules, PostgreSQL and Activity, for attendees and suppliers, from CSV
// and Excel files, with the model off, failing or answering (a fake model server). Checks that
// nothing is written before confirm, that only this event receives the rows, that the import is
// all or nothing, that tampered steps are caught, and that refused roles change nothing. Only the
// signed-in identity is mocked.
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
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
const { createAttendeeAction } = await import("@/modules/events/attendees/public");
const { importStepAction } = await import("./actions");
const { IMPORT_MESSAGES, initialImportState } = await import("./import-state");
const { getEventActivity } = await import("../activity");
const { describeAuditEntry } = await import("@/modules/events/audit/public");
const { xlsx } = await import("./infrastructure/parsers/xlsx-test-file");

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
    return await createAttendeeAction(eventId, { status: "idle" } as never, form(fields));
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

/** What the wizard carries to the next step, from a map step. */
function carried(mapped: State): Record<string, string> {
  if (mapped.step !== "map") throw new Error(`upload failed: ${JSON.stringify(mapped)}`);
  const carry: Record<string, string> = {
    importType: mapped.importType,
    csv: mapped.csv,
    fileName: mapped.fileName,
    fileType: mapped.fileType,
    aiSuggested: String(mapped.aiSuggested),
  };
  mapped.mapping.forEach((field, i) => (carry[`map-${i}`] = field ?? ""));
  return carry;
}

/** Upload, then preview with the suggested mapping. */
async function toPreview(
  eventId: string,
  text = FILE,
  extra: Record<string, string> = {},
  file: File = csvFile(text),
) {
  const mapped = await step(eventId, {
    intent: "upload",
    file,
    importType: extra.importType ?? "attendees",
  });
  if (mapped.step !== "map") throw new Error(`upload failed: ${JSON.stringify(mapped)}`);
  const carry = carried(mapped);
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
      "a .xlsx name that isn't an Excel file",
      {
        intent: "upload",
        file: csvFile(
          "x",
          "guests.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
      },
      "guests.xlsx: This doesn't look like an Excel .xlsx file. Save it as .xlsx or CSV and try again.",
    ],
    [
      "a .xls (old Excel) file",
      { intent: "upload", file: csvFile("x", "guests.xls", "application/vnd.ms-excel") },
      IMPORT_MESSAGES.notAccepted,
    ],
    [
      "a .csv name with an image type",
      { intent: "upload", file: csvFile("x", "guests.csv", "image/png") },
      IMPORT_MESSAGES.notAccepted,
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
      importType: "attendees",
      error: message,
    });
  });

  it("refuses a malformed file with the reason", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    expect(await step(eventId, { intent: "upload", file: csvFile('Name\n"Ana') })).toEqual({
      step: "upload",
      importType: "attendees",
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
      importType: "attendees",
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
      importType: "attendees",
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
// ───────────────────────── Batch 9: suppliers, Excel and the AI suggestion ─────────────────────────

const SUPPLIERS = [
  "Vendor,Service,Contact,Mobile,Quote amount",
  "Garden Kitchen,Caterer,hello@garden.ph,0917 123 4567,120000",
  "Boom Bros,Fireworks,,,45000",
  ",Florist,,,",
  "Bloom Co.,Florist,,,18500",
].join("\n");

const supplierCount = (eventId: string) => db.supplier.count({ where: { eventId } });

describe("supplier import (B9-F04, F17)", () => {
  it("matches the columns, reads categories, never imports money, and records it", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const mapped = await step(eventId, {
      intent: "upload",
      importType: "suppliers",
      file: csvFile(SUPPLIERS, "vendors.csv"),
    });
    expect(mapped).toMatchObject({
      step: "map",
      importType: "suppliers",
      // "Contact" holds emails, so it is Email; the amount column has no field.
      mapping: ["name", "category", "email", "phone", null],
      columnTypes: ["text", "text", "email", "phone", "number"],
      notice: { source: "rules", fallback: "off" },
      aiSuggested: false,
    });
    const carry = carried(mapped);
    const preview = await step(eventId, { ...carry, intent: "preview" });
    expect(preview).toMatchObject({
      step: "preview",
      preview: { totals: { rows: 4, valid: 3, invalid: 1, toImport: 3 } },
    });
    expect(await supplierCount(eventId)).toBe(0);

    const done = await step(eventId, { ...carry, intent: "confirm", expected: "3" });
    expect(done).toEqual({
      step: "done",
      importType: "suppliers",
      count: 3,
      first: "SUP-0001",
      last: "SUP-0003",
      skipped: 1,
    });
    const rows = await db.supplier.findMany({ where: { eventId }, orderBy: { number: "asc" } });
    expect(
      rows.map((r) => [r.number, r.name, r.category, r.categoryDetail, r.email, r.phone]),
    ).toEqual([
      [1, "Garden Kitchen", "CATERING", null, "hello@garden.ph", "0917 123 4567"],
      [2, "Boom Bros", "OTHER", "Fireworks", null, null],
      [3, "Bloom Co.", "FLOWERS_AND_STYLING", null, null, null],
    ]);
    expect(await db.supplierQuote.count({ where: { eventId } })).toBe(0);

    const activity = await getEventActivity(eventId);
    if (!activity.ok) throw new Error("activity refused");
    const entry = activity.entries.find((e) => e.action === "suppliers.imported");
    expect(entry && describeAuditEntry(entry)).toEqual({
      summary: "Imported 3 suppliers from a CSV file (SUP-0001 to SUP-0003)",
      lines: ["1 row not imported"],
    });
    expect(JSON.stringify(entry)).not.toMatch(/Garden|garden\.ph|0917/);

    // The same file again: every row is a duplicate.
    const again = await step(eventId, { ...carry, intent: "preview" });
    expect(again).toMatchObject({ preview: { totals: { valid: 0, duplicates: 3 } } });
  });

  it("offers to switch type when the columns look like suppliers, and switches on request", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const mapped = await step(eventId, {
      intent: "upload",
      importType: "attendees",
      file: csvFile(SUPPLIERS, "vendors.csv"),
    });
    expect(mapped).toMatchObject({ step: "map", importType: "attendees", looksLike: "suppliers" });
    const switched = await step(eventId, {
      ...carried(mapped),
      intent: "switch-type",
      switchTo: "suppliers",
    });
    expect(switched).toMatchObject({
      step: "map",
      importType: "suppliers",
      mapping: ["name", "category", "email", "phone", null],
    });
  });

  it("checks a supplier mapping with the supplier rules, and refuses Viewers", async () => {
    const owner = await newUser();
    const viewer = await newUser();
    const eventId = await newEvent(owner.id);
    await join(eventId, viewer.id, "VIEWER");
    signedIn = owner;
    const carry = carried(
      await step(eventId, { intent: "upload", importType: "suppliers", file: csvFile(SUPPLIERS) }),
    );
    expect(await step(eventId, { ...carry, "map-1": "", intent: "preview" })).toMatchObject({
      step: "map",
      errors: ["Choose the column that says what each supplier provides (Category)."],
    });
    // An attendee field sent for a supplier import is refused, not stored.
    expect(
      await step(eventId, { ...carry, "map-4": "rsvpStatus", intent: "preview" }),
    ).toMatchObject({
      step: "map",
      errors: [
        "A column is mapped to a field EventOps doesn't have. Choose a listed field or Don't import.",
      ],
    });
    signedIn = viewer;
    expect(await step(eventId, { ...carry, intent: "confirm", expected: "3" })).toEqual({
      step: "upload",
      error: IMPORT_MESSAGES.forbidden,
    });
    expect(await supplierCount(eventId)).toBe(0);
  });

  it("imports suppliers only into the event in the address", async () => {
    const owner = await newUser();
    const eventA = await newEvent(owner.id);
    const eventB = await newEvent(owner.id);
    signedIn = owner;
    const carry = carried(
      await step(eventA, { intent: "upload", importType: "suppliers", file: csvFile(SUPPLIERS) }),
    );
    await step(eventB, { ...carry, intent: "confirm", expected: "3" });
    expect(await supplierCount(eventA)).toBe(0);
    expect(await supplierCount(eventB)).toBe(3);
  });

  it("is all or nothing for suppliers too", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const carry = carried(
      await step(eventId, { intent: "upload", importType: "suppliers", file: csvFile(SUPPLIERS) }),
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE suppliers ADD CONSTRAINT import_test_no_boom CHECK (name <> 'Boom Bros') NOT VALID`,
    );
    try {
      expect(await step(eventId, { ...carry, intent: "confirm", expected: "3" })).toMatchObject({
        step: "preview",
        message: IMPORT_MESSAGES.failed,
      });
    } finally {
      await db.$executeRawUnsafe(`ALTER TABLE suppliers DROP CONSTRAINT import_test_no_boom`);
    }
    expect(await supplierCount(eventId)).toBe(0);
    expect((await db.event.findUniqueOrThrow({ where: { id: eventId } })).lastSupplierNumber).toBe(
      0,
    );
    expect(await db.auditLog.count({ where: { eventId, action: "suppliers.imported" } })).toBe(0);
  });
});

describe("Excel import (B9-F03)", () => {
  const workbook = () =>
    new File(
      [
        new Uint8Array(
          xlsx({
            Notes: [["Nothing here"]],
            Guests: [
              ["Guest Name", "E-mail", "RSVP", "Plus ones"],
              ["Ana Reyes", "ana@example.com", "Yes", 1],
              ["Ben Lim", "+63 917 123 4567", "Maybe", 0],
              ["José Peña", null, "No", null],
            ],
          }),
        ),
      ],
      "guests.xlsx",
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    );

  it("reads the chosen sheet, keeps values exactly, imports and records the file type", async () => {
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const first = await step(eventId, { intent: "upload", file: workbook() });
    // The first sheet has no guests: the user can pick another.
    expect(first).toMatchObject({ step: "upload", importType: "attendees" });

    const mapped = await step(eventId, { intent: "upload", file: workbook(), sheet: "Guests" });
    expect(mapped).toMatchObject({
      step: "map",
      fileType: "xlsx",
      sheet: "Guests",
      sheets: ["Notes", "Guests"],
      rowCount: 3,
      mapping: ["name", "email", "rsvpStatus", "plusOnes"],
    });
    // A value starting with "+" is carried exactly, not changed by the download formula guard.
    if (mapped.step === "map") expect(mapped.csv).toContain("+63 917 123 4567");
    const carry = carried(mapped);
    const preview = await step(eventId, { ...carry, sheet: "Guests", intent: "preview" });
    expect(preview).toMatchObject({ preview: { totals: { valid: 2, invalid: 1 } } });
    expect(
      await step(eventId, { ...carry, sheet: "Guests", intent: "confirm", expected: "2" }),
    ).toMatchObject({ step: "done", count: 2 });

    const activity = await getEventActivity(eventId);
    if (!activity.ok) throw new Error("activity refused");
    const entry = activity.entries.find((e) => e.action === "attendees.imported");
    expect(entry && describeAuditEntry(entry).summary).toBe(
      "Imported 2 attendees from an Excel file (ATT-0001 to ATT-0002)",
    );

    // "Choose another sheet" goes back to the upload with the sheets listed.
    expect(
      await step(eventId, {
        ...carry,
        sheets: JSON.stringify(["Notes", "Guests"]),
        intent: "pick-sheet",
      }),
    ).toEqual({
      step: "upload",
      importType: "attendees",
      sheets: ["Notes", "Guests"],
      sheet: undefined,
    });
  });
});

describe("AI suggestion (B9-F12 to F16; D-111, D-112)", () => {
  let server: Server;
  let answer: (body: string) => { status: number; body: string } | null = () => null;
  const saved = { enabled: process.env.AI_IMPORT_ENABLED, url: process.env.OLLAMA_URL };

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const reply = answer(raw);
        if (!reply) return; // never answers
        res.statusCode = reply.status;
        res.end(reply.body);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    process.env.AI_IMPORT_ENABLED = "true";
    process.env.OLLAMA_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    process.env.AI_IMPORT_ENABLED = saved.enabled;
    process.env.OLLAMA_URL = saved.url;
    if (saved.enabled === undefined) delete process.env.AI_IMPORT_ENABLED;
    if (saved.url === undefined) delete process.env.OLLAMA_URL;
    server.closeAllConnections();
    server.close();
  });

  const MESSY = [
    "Who,Reply,Reach me",
    "Ana Reyes,yes,ana@example.com",
    "Ben Lim,no,ben@example.com",
  ].join("\n");
  const reply = (content: unknown) => () => ({
    status: 200,
    body: JSON.stringify({ message: { role: "assistant", content: JSON.stringify(content) } }),
  });

  it("uses a valid suggestion, labels it, still validates every row, and records that AI suggested it", async () => {
    answer = reply({
      looksLike: "attendees",
      columns: [
        { index: 0, field: "name" },
        { index: 1, field: "rsvpStatus" },
        { index: 2, field: "email" },
      ],
    });
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    const mapped = await step(eventId, { intent: "upload", file: csvFile(MESSY) });
    expect(mapped).toMatchObject({
      step: "map",
      mapping: ["name", "rsvpStatus", "email"],
      suggested: ["name", "rsvpStatus", "email"],
      notice: { source: "ai", model: "Qwen2.5 7B Instruct (Apache-2.0)" },
      aiSuggested: true,
    });
    // Nothing is saved by the suggestion itself: the user still previews and confirms.
    expect(await attendeeCount(eventId)).toBe(0);
    const carry = carried(mapped);
    expect(await step(eventId, { ...carry, intent: "confirm", expected: "2" })).toMatchObject({
      step: "done",
      count: 2,
    });
    const activity = await getEventActivity(eventId);
    if (!activity.ok) throw new Error("activity refused");
    const entry = activity.entries.find((e) => e.action === "attendees.imported");
    expect(entry && describeAuditEntry(entry).lines).toContain(
      "Column matching suggested by AI and checked before importing",
    );
  });

  it.each([
    [
      "answers invalid JSON",
      () => ({ status: 200, body: '{"message":{"content":"name, rsvp"}}' }),
      "unavailable",
    ],
    ["is down (HTTP 500)", () => ({ status: 500, body: "" }), "unavailable"],
    [
      "maps to a field of the other type",
      reply({
        looksLike: "attendees",
        columns: [
          { index: 0, field: "name" },
          { index: 1, field: "category" },
          { index: 2, field: "contactName" },
        ],
      }),
      "rejected",
    ],
    [
      "uses a field twice",
      reply({
        looksLike: "attendees",
        columns: [
          { index: 0, field: "name" },
          { index: 1, field: "name" },
        ],
      }),
      "rejected",
    ],
  ])("falls back to the rules when the model %s", async (_label, respond, fallback) => {
    answer = respond;
    const owner = await newUser();
    const eventId = await newEvent(owner.id);
    signedIn = owner;
    expect(await step(eventId, { intent: "upload", file: csvFile(MESSY) })).toMatchObject({
      step: "map",
      // The rules know none of these headers, but the emails give Email.
      mapping: [null, null, "email"],
      notice: { source: "rules", fallback },
      aiSuggested: false,
    });
  });
});