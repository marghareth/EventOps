// src/modules/events/accessibility/integration.db.test.ts
// Accessibility integration (B3-15): the whole chain against PostgreSQL, through the real server
// actions and reads as signed-in users:
//
//   Attendee → Requirement → Resource → Readiness → Gaps → Alert
//
// Each step changes stored data and checks what the readiness, gaps and alerts say about it, that
// refused callers change nothing, and that every change reaches Activity. Only the signed-in
// identity is mocked. Run with `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

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
const { createAttendeeAction, updateAttendeeAction, deleteAttendeeAction } =
  await import("../attendees/actions");
const { initialAttendeeFormState } = await import("../attendees/form-state");
const { getEventActivity } = await import("../activity");
const { createRequirementAction, saveResourceAction, deleteResourceAction } =
  await import("./actions");
const { getAccessibilityOverview, getAccessibilityAlerts } = await import("./queries");
const { initialRequirementFormState, initialResourceFormState } = await import("./form-state");

const YEAR = 2083;
const userIds: string[] = [];

type User = { id: string; email: string };

async function newUser(): Promise<User> {
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

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** Runs a server action as `user`; a successful one redirects. Fails the test otherwise. */
async function as(user: User, run: () => Promise<unknown>) {
  signedIn = user;
  try {
    const result = await run();
    throw new Error(`expected a redirect, got ${JSON.stringify(result)}`);
  } catch (error) {
    const to = (error as { url?: string }).url;
    if (!to || to.startsWith("/login")) throw error;
  } finally {
    signedIn = null;
  }
}

/** Runs a server action as `user` and expects it refused (an error state, no redirect). */
async function refused(user: User, run: () => Promise<unknown>) {
  signedIn = user;
  try {
    expect(await run()).toMatchObject({ status: "error" });
  } finally {
    signedIn = null;
  }
}

/** What a member reading the event sees: status, gaps and alerts, from the real reads. */
async function readAs(user: User, eventId: string) {
  signedIn = user;
  try {
    const overview = await getAccessibilityOverview(eventId);
    const alerts = await getAccessibilityAlerts(eventId);
    if (!overview.ok || !alerts.ok) throw new Error("read refused");
    expect(alerts.status).toBe(overview.readiness.status);
    return {
      status: overview.readiness.status,
      gaps: overview.readiness.gaps.map((g) => `${g.key} ${g.consequence}`),
      alerts: alerts.alerts.map((a) => `${a.severity}: ${a.title}`),
      event: alerts.event?.title ?? null,
    };
  } finally {
    signedIn = null;
  }
}

async function guestAlerts(user: User, eventId: string, attendeeId: string) {
  signedIn = user;
  try {
    const result = await getAccessibilityAlerts(eventId, { attendeeId });
    if (!result.ok) throw new Error("read refused");
    return result.alerts.map((a) => a.title);
  } finally {
    signedIn = null;
  }
}

const resourceForm = (status: string, quantity: string, version = "") =>
  form({ status, quantity, note: "", version });
const resourceVersion = async (eventId: string, type: "CAPTIONING" | "ACCESSIBLE_SEATS") =>
  (
    await db.accessibilityResource.findFirstOrThrow({ where: { eventId, type } })
  ).updatedAt.toISOString();

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

it("attendee → requirement → resource → readiness → gaps → alert, with authorization and Activity (B3-15)", async () => {
  const owner = await newUser();
  const coordinator = await newUser();
  const viewer = await newUser();
  const outsider = await newUser();
  const eventId = await newEvent(owner.id);
  const otherEvent = await newEvent(outsider.id);
  const join = (userId: string, role: MemberRole) =>
    db.eventMember.create({ data: { eventId, userId, role } });
  await join(coordinator.id, "COORDINATOR");
  await join(viewer.id, "VIEWER");

  // 1. Attendees: nothing to check yet.
  await as(owner, () =>
    createAttendeeAction(eventId, initialAttendeeFormState, form({ name: "Maria Santos" })),
  );
  await as(owner, () =>
    createAttendeeAction(eventId, initialAttendeeFormState, form({ name: "Ben Lim" })),
  );
  const [maria, ben] = await db.attendee.findMany({
    where: { eventId },
    orderBy: { number: "asc" },
  });
  expect(await readAs(viewer, eventId)).toEqual({
    status: "NO_REQUIRED_NEEDS",
    gaps: [],
    alerts: [],
    event: null,
  });

  // 2. Requirements: two Required needs and one Preferred; nothing set up, so Not ready.
  const addNeed = (attendeeId: string, type: string, priority: string) =>
    as(coordinator, () =>
      createRequirementAction(
        eventId,
        attendeeId,
        initialRequirementFormState,
        form({ type, priority, note: "Private health detail" }),
      ),
    );
  await addNeed(maria.id, "CAPTIONING", "REQUIRED");
  await addNeed(maria.id, "ACCESSIBLE_SEATING", "REQUIRED");
  await addNeed(ben.id, "SIGN_LANGUAGE", "PREFERRED");
  expect(await readAs(viewer, eventId)).toEqual({
    status: "NOT_READY",
    gaps: [
      "ACCESSIBLE_SEATS:not-set-up not-ready",
      "CAPTIONING:not-set-up not-ready",
      "SIGN_LANGUAGE:not-set-up advice",
    ],
    alerts: ["critical: Accessible seats is not set up", "critical: Captioning is not set up"],
    event: "Accessibility: Not ready",
  });
  expect(await guestAlerts(viewer, eventId, maria.id)).toEqual([
    "Accessible seats is not set up",
    "Captioning is not set up",
  ]);
  expect(await guestAlerts(viewer, eventId, ben.id)).toEqual([]); // advice never alerts

  // Refused at this point: a Viewer setting a resource up; another event's owner reading or
  // writing. Nothing changes.
  await refused(viewer, () =>
    saveResourceAction(
      eventId,
      "CAPTIONING",
      initialResourceFormState,
      resourceForm("AVAILABLE", ""),
    ),
  );
  await refused(outsider, () =>
    saveResourceAction(
      eventId,
      "CAPTIONING",
      initialResourceFormState,
      resourceForm("AVAILABLE", ""),
    ),
  );
  signedIn = outsider;
  expect(await getAccessibilityOverview(eventId)).toEqual({ ok: false, reason: "not-found" });
  expect(await getAccessibilityAlerts(eventId)).toEqual({ ok: false, reason: "not-found" });
  expect(await getAccessibilityAlerts(otherEvent, { attendeeId: maria.id })).toMatchObject({
    ok: true,
    alerts: [],
  });
  signedIn = null;
  expect(await db.accessibilityResource.count({ where: { eventId } })).toBe(0);
  expect((await readAs(owner, eventId)).status).toBe("NOT_READY");

  // 3. Resources: one seat covers Maria; captioning still being arranged keeps it Almost ready.
  await as(coordinator, () =>
    saveResourceAction(
      eventId,
      "CAPTIONING",
      initialResourceFormState,
      resourceForm("ARRANGING", ""),
    ),
  );
  await as(owner, () =>
    saveResourceAction(
      eventId,
      "ACCESSIBLE_SEATS",
      initialResourceFormState,
      resourceForm("AVAILABLE", "1"),
    ),
  );
  expect(await readAs(viewer, eventId)).toEqual({
    status: "ALMOST_READY",
    gaps: ["CAPTIONING:being-arranged almost-ready", "SIGN_LANGUAGE:not-set-up advice"],
    alerts: ["warning: Captioning is still being arranged"],
    event: "Accessibility: Almost ready",
  });

  // 4. Captioning confirmed: Ready; only the Preferred advice is left, and no alert.
  const v1 = await resourceVersion(eventId, "CAPTIONING");
  await as(owner, () =>
    saveResourceAction(
      eventId,
      "CAPTIONING",
      initialResourceFormState,
      resourceForm("AVAILABLE", "", v1),
    ),
  );
  expect(await readAs(viewer, eventId)).toEqual({
    status: "READY",
    gaps: ["SIGN_LANGUAGE:not-set-up advice"],
    alerts: [],
    event: null,
  });

  // 5. Attendee side changes readiness too: Ben now needs a seat as well; one seat is not enough.
  await addNeed(ben.id, "ACCESSIBLE_SEATING", "REQUIRED");
  expect(await readAs(viewer, eventId)).toMatchObject({
    status: "NOT_READY",
    alerts: ["critical: Not enough accessible seats"],
  });
  // Ben declines: his needs stop counting, and the event is Ready again.
  const benNow = await db.attendee.findUniqueOrThrow({ where: { id: ben.id } });
  await as(owner, () =>
    updateAttendeeAction(
      eventId,
      ben.id,
      initialAttendeeFormState,
      form({
        name: benNow.name,
        rsvpStatus: "DECLINED",
        plusOnes: "0",
        version: benNow.updatedAt.toISOString(),
      }),
    ),
  );
  expect((await readAs(viewer, eventId)).status).toBe("READY");

  // 6. Removing a resource brings the gap and the alert back.
  await as(coordinator, () => deleteResourceAction(eventId, "CAPTIONING"));
  expect(await readAs(viewer, eventId)).toMatchObject({
    status: "NOT_READY",
    gaps: ["CAPTIONING:not-set-up not-ready"],
    alerts: ["critical: Captioning is not set up"],
  });

  // 7. Removing the guest removes their needs with them: nothing to check.
  await as(owner, () => deleteAttendeeAction(eventId, maria.id));
  expect(await readAs(viewer, eventId)).toMatchObject({
    status: "NO_REQUIRED_NEEDS",
    alerts: [],
    event: null,
  });

  // Activity: every accessibility change, in order, by who made it; no note anywhere.
  signedIn = owner;
  const activity = await getEventActivity(eventId);
  signedIn = null;
  if (!activity.ok) throw new Error("activity refused");
  const expected = [
    ["accessibility_requirement.created", coordinator.id],
    ["accessibility_requirement.created", coordinator.id],
    ["accessibility_requirement.created", coordinator.id],
    ["accessibility_resource.created", coordinator.id],
    ["accessibility_resource.created", owner.id],
    ["accessibility_resource.updated", owner.id],
    ["accessibility_requirement.created", coordinator.id],
    ["accessibility_resource.deleted", coordinator.id],
  ];
  // In the feed, oldest first.
  expect(
    [...activity.entries]
      .reverse()
      .map((e) => e.action ?? "")
      .filter((action) => action.startsWith("accessibility_")),
  ).toEqual(expected.map(([action]) => action));
  // In the table, with who made each change.
  const stored = await db.auditLog.findMany({
    where: { eventId, action: { startsWith: "accessibility_" } },
    orderBy: { createdAt: "asc" },
  });
  expect(stored.map((e) => [e.action, e.actorId])).toEqual(expected);
  expect(JSON.stringify(await db.auditLog.findMany({ where: { eventId } }))).not.toContain(
    "Private health detail",
  );
  // The other event was never touched.
  expect(await db.auditLog.count({ where: { eventId: otherEvent } })).toBe(1);
});