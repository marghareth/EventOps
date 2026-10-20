// src/modules/events/health/health.db.test.ts
// Event Health against PostgreSQL (B8-F01 to B8-F17; D-105 to D-107), through the real reads of
// every context. Event A has real problems in every area; event B has look-alike records. Every
// caller in the required matrix is tried: Owner, Coordinator and Viewer see the same health; only
// Owner and Coordinator get recent activity; a non-member, the other event's Owner and the signed out
// are refused. Health never shows another event's records, never returns a contact value, and
// writes nothing.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}
// The budget and task contexts read through the shared `db` client; point it at the test database.
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;

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

const { createPrismaClient } = await import("@/lib/db");
const { createEvent } = await import("../create-event");
const { getEventHealth } = await import("./queries");
const { getAttendeeHealthFacts } = await import("@/modules/events/attendees/public");

const YEAR = 2084;
const userIds: string[] = [];
const PAST = new Date("2020-01-15T00:00:00Z");

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
      venue: null,
      description: null,
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      endsAt: null,
      capacity: 3,
      expectedAttendees: 2,
    },
    creatorId: ownerId,
    now: new Date(`${YEAR}-01-01`),
  });
  return id;
}

async function addMember(eventId: string, userId: string, role: MemberRole) {
  return db.eventMember.create({ data: { eventId, userId, role } });
}

/** Problems in every area, plus the audit entry the event's creation wrote. */
async function seedProblems(eventId: string, prefix: string) {
  const guests = [
    {
      number: 1,
      name: `${prefix} Ana`,
      email: "ana@example.test",
      rsvpStatus: "CONFIRMED",
      plusOnes: 3,
    },
    { number: 2, name: `${prefix} Ben`, email: null, rsvpStatus: "PENDING", plusOnes: 0 },
  ] as const;
  const created = [];
  for (const g of guests) {
    created.push(await db.attendee.create({ data: { eventId, ...g } }));
  }
  await db.event.update({ where: { id: eventId }, data: { lastAttendeeNumber: 2 } });
  await db.accessibilityRequirement.create({
    data: { eventId, attendeeId: created[0]!.id, type: "CAPTIONING", priority: "REQUIRED" },
  });

  const catering = await db.supplier.create({
    data: {
      eventId,
      number: 1,
      name: `${prefix} Catering`,
      category: "CATERING",
      phone: "0917 555 0101",
    },
  });
  const florist = await db.supplier.create({
    data: { eventId, number: 2, name: `${prefix} Florist`, category: "FLOWERS_AND_STYLING" },
  });
  await db.supplierQuote.create({
    data: { eventId, supplierId: catering.id, number: 1, amount: "1000.00", status: "ACCEPTED" },
  });
  await db.supplierPayment.create({
    data: {
      eventId,
      supplierId: catering.id,
      number: 1,
      kind: "DEPOSIT",
      amount: "300.00",
      dueDate: PAST,
    },
  });
  await db.event.update({
    where: { id: eventId },
    data: { lastSupplierNumber: 2, lastQuoteNumber: 1, lastPaymentNumber: 1 },
  });
  void florist;

  const category = await db.budgetCategory.create({
    data: { eventId, name: `${prefix} Catering`, allocationAmount: "100.00" },
  });
  await db.budgetItem.create({
    data: {
      eventId,
      categoryId: category.id,
      number: 1,
      name: "Food",
      estimatedAmount: "150.00",
      committedAmount: "150.00",
      paidAmount: "0.00",
    },
  });
  await db.event.update({ where: { id: eventId }, data: { lastBudgetItemNumber: 1 } });

  await db.task.create({
    data: {
      eventId,
      number: 1,
      title: `${prefix} Confirm catering`,
      priority: "HIGH",
      status: "NOT_STARTED",
      dueDate: PAST,
    },
  });
  await db.event.update({ where: { id: eventId }, data: { lastTaskNumber: 1 } });
}

async function world() {
  const owner = await newUser("Mika");
  const coordinator = await newUser("Ana");
  const viewer = await newUser("Vic");
  const outsider = await newUser("Olga");
  const ownerB = await newUser("Bea");
  const eventA = await newEvent(owner.id, "Santos wedding");
  const eventB = await newEvent(ownerB.id, "Reyes debut");
  await addMember(eventA, coordinator.id, "COORDINATOR");
  await addMember(eventA, viewer.id, "VIEWER");
  await seedProblems(eventA, "A");
  await seedProblems(eventB, "B");
  return { owner, coordinator, viewer, outsider, ownerB, eventA, eventB };
}

/** Everything that could change, in both events. Health must change none of it. */
async function everything(eventA: string, eventB: string) {
  const where = { eventId: { in: [eventA, eventB] } };
  return {
    events: await db.event.findMany({
      where: { id: { in: [eventA, eventB] } },
      orderBy: { id: "asc" },
    }),
    attendees: await db.attendee.count({ where }),
    audit: await db.auditLog.count({ where }),
    tasks: await db.task.findMany({ where, orderBy: { id: "asc" } }),
  };
}

beforeAll(() => {
  db = createPrismaClient(url);
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

describe("Event Health from stored data (B8-F01 to B8-F10)", () => {
  it("finds the seeded problem in every area, with the right severity", async () => {
    const w = await world();
    signedIn = w.owner;
    const result = await getEventHealth(w.eventA, { withActivity: true });
    if (!result.ok) throw new Error(`refused: ${result.reason}`);
    const outcome = Object.fromEntries(result.health.checks.map((c) => [c.id, c.outcome]));
    expect(outcome).toEqual({
      "attendees.list": "PASSED",
      "attendees.rsvp": "NEEDS_ATTENTION",
      "attendees.contact": "NEEDS_ATTENTION",
      // Ana + 3 plus-ones = 4 confirmed people against a capacity of 3.
      "attendees.capacity": "CRITICAL",
      "attendees.planning": "NEEDS_ATTENTION",
      "suppliers.confirmed": "NEEDS_ATTENTION",
      "suppliers.overdue": "CRITICAL",
      "suppliers.contact": "NEEDS_ATTENTION",
      "budget.event": "CRITICAL",
      "budget.categories": "CRITICAL",
      "accessibility.readiness": "CRITICAL",
      "tasks.overdue": "CRITICAL",
      "tasks.unassigned": "NEEDS_ATTENTION",
    });
    expect(result.health.status).toBe("AT_RISK");
    expect(result.health.score).toEqual({ percent: 7, passed: 1, evaluated: 13 });
    expect(result.health.issues[0]).toMatchObject({
      id: "attendees.capacity",
      outcome: "CRITICAL",
    });
    const unconfirmed = result.health.checks.find((c) => c.id === "suppliers.confirmed")!;
    expect(unconfirmed.references).toEqual(["SUP-0002"]);
    expect(unconfirmed.reason).toContain("A Florist (SUP-0002)");
    expect(result.health.checks.find((c) => c.id === "budget.event")!.reason).toContain(
      "₱150.00 is committed against ₱100.00 allocated",
    );
  });

  it("never shows another event's records", async () => {
    const w = await world();
    signedIn = w.owner;
    const result = await getEventHealth(w.eventA, { withActivity: true });
    if (!result.ok) throw new Error("refused");
    const text = JSON.stringify(result);
    expect(text).not.toMatch(/B Ana|B Ben|B Catering|B Florist|B Confirm catering/);
  });

  it("never returns a contact value, even to the Owner", async () => {
    const w = await world();
    signedIn = w.owner;
    const result = await getEventHealth(w.eventA, { withActivity: true });
    expect(JSON.stringify(result)).not.toMatch(/ana@example\.test|0917 555 0101/);
  });

  it("writes nothing", async () => {
    const w = await world();
    const before = await everything(w.eventA, w.eventB);
    for (const user of [w.owner, w.coordinator, w.viewer]) {
      signedIn = user;
      await getEventHealth(w.eventA, { withActivity: true });
    }
    expect(await everything(w.eventA, w.eventB)).toEqual(before);
  });
});

describe("who sees health (B8-F16, B8-F17)", () => {
  it("shows every member the same health; recent activity only to Owners and Coordinators", async () => {
    const w = await world();
    const seen: Record<string, unknown> = {};
    for (const [name, user] of [
      ["owner", w.owner],
      ["coordinator", w.coordinator],
      ["viewer", w.viewer],
    ] as const) {
      signedIn = user;
      const result = await getEventHealth(w.eventA, { withActivity: true });
      if (!result.ok) throw new Error(`${name} refused`);
      seen[name] = result.health;
      if (name === "viewer") expect(result.activity).toEqual({ status: "hidden" });
      else {
        expect(result.activity).toMatchObject({ status: "ok" });
        if (result.activity.status === "ok") {
          expect(result.activity.entries[0]?.summary).toBe(
            `Created the event ${(await db.event.findUniqueOrThrow({ where: { id: w.eventA } })).reference}`,
          );
          expect(result.activity.entries[0]?.who).toBe("Mika");
        }
      }
    }
    expect(seen.coordinator).toEqual(seen.owner);
    expect(seen.viewer).toEqual(seen.owner);
  });

  it("refuses non-members and the other event's Owner like an unknown event", async () => {
    const w = await world();
    for (const user of [w.outsider, w.ownerB]) {
      signedIn = user;
      expect(await getEventHealth(w.eventA, { withActivity: true })).toEqual({
        ok: false,
        reason: "not-found",
      });
    }
    expect(await getEventHealth(randomUUID(), { withActivity: true })).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("sends the signed out to sign in", async () => {
    const w = await world();
    signedIn = null;
    await expect(getEventHealth(w.eventA, { withActivity: true })).rejects.toMatchObject({
      url: expect.stringContaining("/login"),
    });
  });

  it("leaves recent activity out when not asked for", async () => {
    const w = await world();
    signedIn = w.owner;
    const result = await getEventHealth(w.eventA, { withActivity: false });
    expect(result).toMatchObject({ ok: true, activity: { status: "hidden" } });
  });
});

describe("a brand-new event (B8-F19)", () => {
  it("has no score and no status: nothing to check yet", async () => {
    const owner = await newUser("Mika");
    const eventId = await newEvent(owner.id, "Empty");
    signedIn = owner;
    const result = await getEventHealth(eventId, { withActivity: false });
    if (!result.ok) throw new Error("refused");
    expect(result.health.score).toBeNull();
    expect(result.health.status).toBeNull();
    expect(result.health.counts.NOT_CHECKED).toBe(13);
  });
});

describe("the attendee facts health reads (B8-F02, D-105)", () => {
  it("refuses non-members on its own, and gives members only yes or no for contact", async () => {
    const w = await world();
    signedIn = w.outsider;
    expect(await getAttendeeHealthFacts(w.eventA)).toEqual({ ok: false, reason: "not-found" });
    signedIn = w.viewer;
    const facts = await getAttendeeHealthFacts(w.eventA);
    if (!facts.ok) throw new Error("refused");
    expect(facts.attendees.map(({ name, hasContact }) => [name, hasContact])).toEqual([
      ["A Ana", true],
      ["A Ben", false],
    ]);
    expect(Object.keys(facts.attendees[0]!).sort()).toEqual([
      "hasContact",
      "name",
      "number",
      "plusOnes",
      "rsvpStatus",
    ]);
  });
});