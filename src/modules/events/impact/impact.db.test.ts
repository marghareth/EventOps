// src/modules/events/impact/impact.db.test.ts
// Impact against PostgreSQL (B7-F11 to B7-F15; D-101 to D-104), through the real server actions and
// the page read. Two events, each with a budget and a task. Every caller in the required matrix
// (owner, coordinator, viewer, non-member, signed out, a member of the other event, substituted IDs)
// is tried; a refusal changes nothing in either event. The database itself refuses a catering
// category from another event, keeps saved analyses append-only, and clears a deleted category.
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
const { saveAnalysisAction, saveAssumptionsAction } = await import("./actions");
const { getImpactWorkspace } = await import("./queries");
const { prismaImpactRepository } = await import("./infrastructure/prisma-impact-repository");
const { describeAuditEntry: describeEntry } = await import("@/modules/events/audit/public");
/** Activity's words for a stored row, the way the Activity page reads it. */
const describeAuditEntry = (row: { action: string; details: unknown }) =>
  describeEntry({
    action: row.action as Parameters<typeof describeEntry>[0]["action"],
    details: row.details as Parameters<typeof describeEntry>[0]["details"],
  });

const YEAR = 2083;
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
      venue: null,
      description: null,
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      endsAt: null,
      capacity: 200,
      expectedAttendees: 180,
    },
    creatorId: ownerId,
    now: new Date(`${YEAR}-01-01`),
  });
  return id;
}

async function addMember(eventId: string, userId: string, role: MemberRole) {
  await db.eventMember.create({ data: { eventId, userId, role } });
}

async function addCategory(eventId: string, name: string, allocation: string, committed: string) {
  const category = await db.budgetCategory.create({
    data: { eventId, name, allocationAmount: allocation },
  });
  await db.budgetItem.create({
    data: {
      eventId,
      categoryId: category.id,
      number: 1,
      name: `${name} item`,
      estimatedAmount: committed,
      committedAmount: committed,
      paidAmount: "0.00",
    },
  });
  return category.id;
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
  const cateringA = await addCategory(eventA, "Catering", "100000.00", "95000.00");
  const cateringB = await addCategory(eventB, "Catering", "100000.00", "1000.00");
  await db.task.create({
    data: {
      eventId: eventA,
      number: 1,
      title: "Confirm catering headcount",
      priority: "MEDIUM",
      status: "NOT_STARTED",
    },
  });
  return { owner, coordinator, viewer, outsider, ownerB, eventA, eventB, cateringA, cateringB };
}

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

const assumptionsForm = (overrides: Record<string, string> = {}) =>
  form({
    cateringCostPerHead: "300",
    accessibleSeatsPer100: "4.55",
    cateringCategoryId: "",
    version: "",
    ...overrides,
  });

/** Runs an action and returns its redirect target, or its returned state. */
async function act<T>(run: () => Promise<T>): Promise<{ redirect: string } | { state: T }> {
  try {
    return { state: await run() };
  } catch (error) {
    const target = (error as { url?: string }).url;
    if (target) return { redirect: target };
    throw error;
  }
}

/** Everything an impact write could change, in both events. */
async function snapshot(eventA: string, eventB: string) {
  const where = { eventId: { in: [eventA, eventB] } };
  return {
    assumptions: await db.eventImpactAssumptions.findMany({ where, orderBy: { eventId: "asc" } }),
    analyses: await db.impactAnalysis.count({ where }),
    counters: await db.event.findMany({
      where: { id: { in: [eventA, eventB] } },
      select: { id: true, lastImpactNumber: true, expectedAttendees: true },
      orderBy: { id: "asc" },
    }),
    audit: await db.auditLog.count({ where }),
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

describe("previewing an analysis (B7-F01, B7-F14)", () => {
  it("lets every member preview, reads stored data and writes nothing", async () => {
    const w = await world();
    for (const user of [w.owner, w.coordinator, w.viewer]) {
      signedIn = user;
      const before = await snapshot(w.eventA, w.eventB);
      const page = await getImpactWorkspace(w.eventA, "220");
      if (!page.ok || page.proposal.status !== "analyzed") throw new Error("expected an analysis");
      expect(page.event.expectedAttendees).toBe(180);
      const keys = page.proposal.result.items.map((i) => i.key);
      expect(keys).toContain("seating-capacity");
      expect(page.proposal.result.items.find((i) => i.key === "seating-capacity")?.severity).toBe(
        "CRITICAL",
      );
      expect(page.proposal.result.items.find((i) => i.key === "related-tasks")?.references).toEqual([
        "TSK-0001",
      ]);
      expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
    }
  });

  it("shows only its own event's categories", async () => {
    const w = await world();
    signedIn = w.owner;
    const page = await getImpactWorkspace(w.eventA, undefined);
    if (!page.ok) throw new Error("refused");
    expect(page.categories.map((c) => c.id)).toEqual([w.cateringA]);
    expect(page.proposal).toEqual({ status: "none" });
  });

  it("validates the proposed number from the address", async () => {
    const w = await world();
    signedIn = w.viewer;
    for (const raw of ["", "-5", "2.5", "abc", "1000001"]) {
      const page = await getImpactWorkspace(w.eventA, raw);
      if (!page.ok) throw new Error("refused");
      expect(page.proposal.status).toBe("invalid");
    }
    const same = await getImpactWorkspace(w.eventA, "180");
    if (!same.ok || same.proposal.status !== "analyzed") throw new Error("expected");
    expect(same.proposal.result.noChange).toBe(true);
  });

  it("refuses non-members and another event's members like an unknown event", async () => {
    const w = await world();
    for (const user of [w.outsider, w.ownerB]) {
      signedIn = user;
      expect(await getImpactWorkspace(w.eventA, "220")).toEqual({ ok: false, reason: "not-found" });
    }
    signedIn = null;
    await expect(getImpactWorkspace(w.eventA, "220")).rejects.toMatchObject({
      url: expect.stringContaining("/login"),
    });
  });
});

describe("editing the assumptions (B7-F12, B7-F14, B7-F15)", () => {
  it("lets the Owner and the Coordinator save, with one Activity entry each", async () => {
    const w = await world();
    signedIn = w.owner;
    const first = await act(() =>
      saveAssumptionsAction(w.eventA, { status: "idle" }, assumptionsForm({ to: "220" })),
    );
    expect(first).toEqual({
      redirect: `/events/${w.eventA}/impact?notice=assumptions-saved&to=220`,
    });
    const stored = await db.eventImpactAssumptions.findUniqueOrThrow({
      where: { eventId: w.eventA },
    });
    expect(stored.cateringCostPerHead?.toFixed(2)).toBe("300.00");
    expect(stored.accessibleSeatsPer100?.toFixed(2)).toBe("4.55");

    signedIn = w.coordinator;
    const second = await act(() =>
      saveAssumptionsAction(
        w.eventA,
        { status: "idle" },
        assumptionsForm({
          cateringCategoryId: w.cateringA,
          version: stored.updatedAt.toISOString(),
        }),
      ),
    );
    expect(second).toEqual({ redirect: `/events/${w.eventA}/impact?notice=assumptions-saved` });

    const entries = await db.auditLog.findMany({
      where: { eventId: w.eventA, action: "impact_assumptions.updated" },
      orderBy: { createdAt: "asc" },
    });
    expect(entries.map((e) => describeAuditEntry(e))).toEqual([
      {
        summary: "Changed the impact assumptions",
        lines: [
          "Catering cost per head: not set → ₱300.00",
          "Accessible seats per 100 guests: not set → 4.55",
        ],
      },
      {
        summary: "Changed the impact assumptions",
        lines: ["Catering budget category: not set → “Catering”"],
      },
    ]);
  });

  it("writes nothing when nothing changed", async () => {
    const w = await world();
    signedIn = w.owner;
    await act(() => saveAssumptionsAction(w.eventA, { status: "idle" }, assumptionsForm()));
    const stored = await db.eventImpactAssumptions.findUniqueOrThrow({ where: { eventId: w.eventA } });
    const before = await snapshot(w.eventA, w.eventB);
    const again = await act(() =>
      saveAssumptionsAction(
        w.eventA,
        { status: "idle" },
        assumptionsForm({ version: stored.updatedAt.toISOString() }),
      ),
    );
    expect(again).toEqual({ redirect: `/events/${w.eventA}/impact?notice=assumptions-unchanged` });
    expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
  });

  it("refuses Viewers, non-members, the other event's owner and the signed out, changing nothing", async () => {
    const w = await world();
    const before = await snapshot(w.eventA, w.eventB);
    for (const [user, message] of [
      [w.viewer, "Only Owners and Coordinators can change the assumptions."],
      [w.outsider, "We couldn't find this event."],
      [w.ownerB, "We couldn't find this event."],
    ] as const) {
      signedIn = user;
      const result = await act(() =>
        saveAssumptionsAction(w.eventA, { status: "idle" }, assumptionsForm()),
      );
      expect(result).toMatchObject({ state: { status: "error", message } });
    }
    signedIn = null;
    expect(
      await act(() => saveAssumptionsAction(w.eventA, { status: "idle" }, assumptionsForm())),
    ).toMatchObject({ redirect: expect.stringContaining("/login") });
    expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
  });

  it("refuses another event's budget category (substituted ID), in the action and in the database", async () => {
    const w = await world();
    signedIn = w.owner;
    const before = await snapshot(w.eventA, w.eventB);
    const result = await act(() =>
      saveAssumptionsAction(
        w.eventA,
        { status: "idle" },
        assumptionsForm({ cateringCategoryId: w.cateringB }),
      ),
    );
    expect(result).toMatchObject({
      state: { fieldErrors: { cateringCategoryId: "Choose a budget category of this event, or none." } },
    });
    expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
    await expect(
      db.eventImpactAssumptions.create({
        data: { eventId: w.eventA, cateringCategoryId: w.cateringB },
      }),
    ).rejects.toThrow();
  });

  it("refuses a stale save", async () => {
    const w = await world();
    signedIn = w.owner;
    await act(() => saveAssumptionsAction(w.eventA, { status: "idle" }, assumptionsForm()));
    // A form opened before that first save still carries "no version".
    const stale = await act(() =>
      saveAssumptionsAction(w.eventA, { status: "idle" }, assumptionsForm({ cateringCostPerHead: "1" })),
    );
    expect(stale).toMatchObject({
      state: { message: expect.stringContaining("Someone else changed the assumptions") },
    });
  });

  it("validates every field on the server", async () => {
    const w = await world();
    signedIn = w.owner;
    const result = await act(() =>
      saveAssumptionsAction(
        w.eventA,
        { status: "idle" },
        assumptionsForm({
          cateringCostPerHead: "-1",
          accessibleSeatsPer100: "100.01",
          cateringCategoryId: "not-an-id",
        }),
      ),
    );
    expect(result).toMatchObject({
      state: {
        status: "error",
        fieldErrors: {
          cateringCostPerHead: expect.any(String),
          accessibleSeatsPer100: expect.any(String),
          cateringCategoryId: expect.any(String),
        },
      },
    });
    expect(await db.eventImpactAssumptions.count({ where: { eventId: w.eventA } })).toBe(0);
  });

  it("enforces the value ranges in the database too", async () => {
    const w = await world();
    await expect(
      db.eventImpactAssumptions.create({ data: { eventId: w.eventA, cateringCostPerHead: "-0.01" } }),
    ).rejects.toThrow();
    await expect(
      db.eventImpactAssumptions.create({ data: { eventId: w.eventA, accessibleSeatsPer100: "100.01" } }),
    ).rejects.toThrow();
  });

  it("clears a deleted catering category instead of blocking the deletion", async () => {
    const w = await world();
    signedIn = w.owner;
    await act(() =>
      saveAssumptionsAction(
        w.eventA,
        { status: "idle" },
        assumptionsForm({ cateringCategoryId: w.cateringA }),
      ),
    );
    const before = await db.eventImpactAssumptions.findUniqueOrThrow({ where: { eventId: w.eventA } });
    await db.budgetItem.deleteMany({ where: { categoryId: w.cateringA } });
    await db.budgetCategory.delete({ where: { id: w.cateringA } });
    const after = await db.eventImpactAssumptions.findUniqueOrThrow({ where: { eventId: w.eventA } });
    expect(after.cateringCategoryId).toBeNull();
    expect(after.cateringCostPerHead?.toFixed(2)).toBe("300.00");
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
  });
});

describe("saving an analysis to the history (B7-F11, B7-F13, B7-F14)", () => {
  const save = (eventId: string, values: Record<string, string>) =>
    act(() => saveAnalysisAction(eventId, { status: "idle" }, form({ version: "", from: "180", ...values })));

  it("numbers analyses per event, keeps a snapshot and records Activity", async () => {
    const w = await world();
    signedIn = w.owner;
    expect(await save(w.eventA, { to: "220" })).toEqual({
      redirect: `/events/${w.eventA}/impact?to=220&notice=analysis-saved&ref=IMP-0001`,
    });
    signedIn = w.coordinator;
    expect(await save(w.eventA, { to: "150" })).toMatchObject({
      redirect: expect.stringContaining("ref=IMP-0002"),
    });
    signedIn = w.ownerB;
    expect(await save(w.eventB, { to: "300" })).toMatchObject({
      redirect: expect.stringContaining("ref=IMP-0001"),
    });

    // The event itself never changes.
    const event = await db.event.findUniqueOrThrow({ where: { id: w.eventA } });
    expect(event.expectedAttendees).toBe(180);

    signedIn = w.viewer;
    const page = await getImpactWorkspace(w.eventA, undefined);
    if (!page.ok) throw new Error("refused");
    expect(page.history.map((h) => [h.reference, h.snapshot.from, h.snapshot.to])).toEqual([
      ["IMP-0002", 180, 150],
      ["IMP-0001", 180, 220],
    ]);
    expect(page.history[1]?.createdByName).toBe("Mika");
    expect(page.history[1]?.snapshot.overall).toBe("CRITICAL");

    const entry = await db.auditLog.findFirstOrThrow({
      where: { eventId: w.eventA, action: "impact_analysis.created" },
      orderBy: { createdAt: "asc" },
    });
    expect(describeAuditEntry(entry)).toEqual({
      summary: "Saved the impact analysis IMP-0001: expected attendees 180 → 220",
      lines: ["Overall: Critical"],
    });
  });

  it("refuses Viewers, non-members and the other event's owner without using a number", async () => {
    const w = await world();
    const before = await snapshot(w.eventA, w.eventB);
    for (const [user, message] of [
      [w.viewer, "Only Owners and Coordinators can save analyses to the history."],
      [w.outsider, "We couldn't find this event."],
      [w.ownerB, "We couldn't find this event."],
    ] as const) {
      signedIn = user;
      expect(await save(w.eventA, { to: "220" })).toEqual({ state: { status: "error", message } });
    }
    expect(await snapshot(w.eventA, w.eventB)).toEqual(before);
  });

  it("refuses the repository write when the role is gone, without using a number", async () => {
    const w = await world();
    const repository = prismaImpactRepository(db);
    const result = await repository.saveAnalysis({
      eventId: w.eventA,
      actorId: w.viewer.id,
      snapshot: {
        version: 1,
        from: 180,
        to: 220,
        assumptions: { cateringCostPerHead: null, accessibleSeatsPer100: null, cateringCategory: null },
        overall: "INFO",
        counts: { CRITICAL: 0, NEEDS_ATTENTION: 0, INFO: 1, PASSED: 0 },
        items: [
          {
            key: "x",
            area: "SEATING",
            severity: "INFO",
            title: "x",
            reason: "x",
            basis: "ESTIMATE",
            assumptions: [],
            fix: null,
            references: [],
          },
        ],
      },
    });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    const event = await db.event.findUniqueOrThrow({ where: { id: w.eventA } });
    expect(event.lastImpactNumber).toBe(0);
  });

  it("refuses an analysis whose starting point or assumptions changed since it was seen", async () => {
    const w = await world();
    signedIn = w.owner;
    expect(await save(w.eventA, { to: "220", from: "170" })).toMatchObject({
      state: { message: expect.stringContaining("changed since this analysis ran") },
    });
    await act(() => saveAssumptionsAction(w.eventA, { status: "idle" }, assumptionsForm()));
    expect(await save(w.eventA, { to: "220" })).toMatchObject({
      state: { message: expect.stringContaining("changed since this analysis ran") },
    });
    expect(await db.impactAnalysis.count({ where: { eventId: w.eventA } })).toBe(0);
  });

  it("refuses to save a no-change analysis", async () => {
    const w = await world();
    signedIn = w.owner;
    expect(await save(w.eventA, { to: "180" })).toEqual({
      state: {
        status: "error",
        message: "There's nothing to save: the proposed number is the same as the current one.",
      },
    });
  });

  it("keeps saved analyses append-only, and removes them only with their event", async () => {
    const w = await world();
    signedIn = w.owner;
    await save(w.eventA, { to: "220" });
    const row = await db.impactAnalysis.findFirstOrThrow({ where: { eventId: w.eventA } });
    await expect(
      db.impactAnalysis.update({ where: { id: row.id }, data: { toAttendees: 1 } }),
    ).rejects.toThrow();
    await expect(db.impactAnalysis.delete({ where: { id: row.id } })).rejects.toThrow();
    await db.event.delete({ where: { id: w.eventA } });
    expect(await db.impactAnalysis.count({ where: { id: row.id } })).toBe(0);
  });

  it("leaves out a stored snapshot that doesn't fit the format", async () => {
    const w = await world();
    await db.impactAnalysis.create({
      data: {
        eventId: w.eventA,
        number: 1,
        fromAttendees: 1,
        toAttendees: 2,
        overallSeverity: "INFO",
        result: { version: 99 },
      },
    });
    expect(await prismaImpactRepository(db).listAnalyses(w.eventA, 20)).toEqual([]);
  });
});