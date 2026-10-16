// src/modules/events/budget/authorization.db.test.ts
// Budget security checkpoint (B5-F11; D-035, D-036, D-084, D-085, D-091). One matrix: every caller
// tries every budget operation through the real server actions and reads, the way a crafted request
// would, with no page in between, against PostgreSQL. Allowed operations succeed; denied ones fail,
// change nothing in either event and add nothing to Activity.
//
//   Owner of A        → everything
//   Coordinator of A  → everything (budget.manage)
//   Viewer of A       → reads the budget (event.view); every write and the edit forms denied
//   User B (owner of Event B) on Event A → everything denied
//   Signed out        → everything denied
//
// Budget has no Owner-only operation (docs/PERMISSIONS.md), so there is no Coordinator-denied case.
// A second matrix sends Event B's records through Event A's address (a substituted ID): refused for
// every caller. Only the signed-in identity is mocked.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type MemberRole } from "@/generated/prisma/client";

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

const { createEvent } = await import("../create-event");
const { prismaBudgetRepository } = await import("./infrastructure/prisma-budget-repository");
const {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  createItemAction,
  updateItemAction,
  deleteItemAction,
} = await import("./actions");
const { getEventBudget, getCategoryForEdit, getItemFormContext } = await import("./queries");

const YEAR = 2082;
const userIds: string[] = [];
const idle = { status: "idle" } as const;

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

type EventRecords = { categoryId: string; emptyCategoryId: string; itemId: string };
type World = {
  owner: User;
  userB: User;
  coordinator: User;
  viewer: User;
  eventA: string;
  eventB: string;
  a: EventRecords;
  b: EventRecords;
};

async function world(): Promise<World> {
  const repository = prismaBudgetRepository(db);
  const owner = await newUser();
  const userB = await newUser();
  const coordinator = await newUser();
  const viewer = await newUser();
  const eventA = await newEvent(owner.id);
  const eventB = await newEvent(userB.id);
  const join = (userId: string, role: MemberRole) =>
    db.eventMember.create({ data: { eventId: eventA, userId, role } });
  await join(coordinator.id, "COORDINATOR");
  await join(viewer.id, "VIEWER");
  const records = async (eventId: string, actorId: string): Promise<EventRecords> => {
    const category = await repository.createCategory({
      eventId,
      actorId,
      input: { name: "Venue", allocation: "5000.00" },
    });
    const empty = await repository.createCategory({
      eventId,
      actorId,
      input: { name: "Spare", allocation: "0.00" },
    });
    if (!category.ok || !empty.ok) throw new Error("setup failed");
    const item = await repository.createItem({
      eventId,
      actorId,
      input: {
        categoryId: category.id,
        name: "Deposit",
        estimated: "1000.00",
        committed: "0.00",
        paid: "0.00",
        notes: null,
      },
    });
    if (!item.ok) throw new Error("setup failed");
    return { categoryId: category.id, emptyCategoryId: empty.id, itemId: item.id };
  };
  return {
    owner,
    userB,
    coordinator,
    viewer,
    eventA,
    eventB,
    a: await records(eventA, owner.id),
    b: await records(eventB, userB.id),
  };
}

/** Everything an operation could change, in both events. */
async function snapshot(w: World) {
  const where = { eventId: { in: [w.eventA, w.eventB] } };
  return {
    categories: await db.budgetCategory.findMany({ where, orderBy: { id: "asc" } }),
    items: await db.budgetItem.findMany({ where, orderBy: { id: "asc" } }),
    counters: await db.event.findMany({
      where: { id: { in: [w.eventA, w.eventB] } },
      select: { id: true, lastBudgetItemNumber: true },
      orderBy: { id: "asc" },
    }),
    audit: await db.auditLog.count({ where }),
  };
}

type Outcome = "allowed" | "denied";

/** Server actions redirect when they succeed; a redirect to sign-in is a refusal. */
async function action(run: () => Promise<unknown>): Promise<Outcome> {
  try {
    await run();
    return "denied";
  } catch (error) {
    const to = (error as { url?: string }).url;
    if (to && !to.startsWith("/login")) return "allowed";
    if (to) return "denied";
    throw error;
  }
}

async function read(run: () => Promise<{ ok: boolean }>): Promise<Outcome> {
  try {
    return (await run()).ok ? "allowed" : "denied";
  } catch (error) {
    if ((error as { url?: string }).url?.startsWith("/login")) return "denied";
    throw error;
  }
}

const versionOfCategory = async (id: string) =>
  (await db.budgetCategory.findUniqueOrThrow({ where: { id } })).updatedAt.toISOString();
const versionOfItem = async (id: string) =>
  (await db.budgetItem.findUniqueOrThrow({ where: { id } })).updatedAt.toISOString();

const itemFields = (categoryId: string, name: string) => ({
  categoryId,
  name,
  estimated: "1500",
  committed: "",
  paid: "",
  notes: "",
});

/** `own` is the records of the event whose address is used; `target` is the records acted on. */
type Operation = (eventId: string, target: EventRecords, own: EventRecords) => Promise<Outcome>;

const OPERATIONS: Record<string, Operation> = {
  "read the budget": (eventId) => read(() => getEventBudget(eventId)),
  "open the category edit form": (eventId, target) =>
    read(() => getCategoryForEdit(eventId, target.categoryId)),
  "open the item form": (eventId, target) => read(() => getItemFormContext(eventId, target.itemId)),
  "add a category": (eventId) =>
    action(() => createCategoryAction(eventId, idle, form({ name: "Music", allocation: "100" }))),
  "edit a category": async (eventId, target) =>
    action(async () =>
      updateCategoryAction(
        eventId,
        target.categoryId,
        idle,
        form({
          name: "Venue renamed",
          allocation: "5000",
          version: await versionOfCategory(target.categoryId),
        }),
      ),
    ),
  "delete a category": (eventId, target) =>
    action(() => deleteCategoryAction(eventId, target.emptyCategoryId)),
  "add an item": (eventId, _target, own) =>
    action(() => createItemAction(eventId, idle, form(itemFields(own.categoryId, "Flowers")))),
  "edit an item": async (eventId, target, own) =>
    action(async () =>
      updateItemAction(
        eventId,
        target.itemId,
        idle,
        form({
          ...itemFields(own.categoryId, "Deposit renamed"),
          version: await versionOfItem(target.itemId),
        }),
      ),
    ),
  "delete an item": (eventId, target) => action(() => deleteItemAction(eventId, target.itemId)),
};
const ALL = Object.keys(OPERATIONS);
const READS = ["read the budget", "open the category edit form", "open the item form"];
// The edit forms load a record for editing, so they need budget.manage like the writes do.
const VIEW_ONLY = ["read the budget"];

const CALLERS: { name: string; as: (w: World) => User | null; allowed: string[] }[] = [
  { name: "Owner of A", as: (w) => w.owner, allowed: ALL },
  { name: "Coordinator of A", as: (w) => w.coordinator, allowed: ALL },
  { name: "Viewer of A", as: (w) => w.viewer, allowed: VIEW_ONLY },
  { name: "User B", as: (w) => w.userB, allowed: [] },
  { name: "Signed out", as: () => null, allowed: [] },
];

beforeAll(() => {
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
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

describe.each(CALLERS)("$name on Event A", ({ as, allowed }) => {
  it.each(ALL)("%s", async (operation) => {
    const w = await world();
    const expected: Outcome = allowed.includes(operation) ? "allowed" : "denied";
    const before = await snapshot(w);
    signedIn = as(w);
    expect(await OPERATIONS[operation]!(w.eventA, w.a, w.a)).toBe(expected);
    const after = await snapshot(w);
    if (expected === "denied") expect(after).toEqual(before);
    else if (!READS.includes(operation)) expect(after).not.toEqual(before);
    // Event B is never touched by anything done in Event A.
    expect(after.categories.filter((row) => row.eventId === w.eventB)).toEqual(
      before.categories.filter((row) => row.eventId === w.eventB),
    );
    expect(after.items.filter((row) => row.eventId === w.eventB)).toEqual(
      before.items.filter((row) => row.eventId === w.eventB),
    );
  });
});

// Event B's records sent through Event A's address, by people who may manage Event A.
describe.each(CALLERS.filter((caller) => ["Owner of A", "Coordinator of A"].includes(caller.name)))(
  "$name sending Event B's records to Event A (substituted IDs)",
  ({ as }) => {
    const SUBSTITUTED = ALL.filter(
      (operation) => !["read the budget", "add a category", "add an item"].includes(operation),
    );
    it.each(SUBSTITUTED)("%s", async (operation) => {
      const w = await world();
      const before = await snapshot(w);
      signedIn = as(w);
      expect(await OPERATIONS[operation]!(w.eventA, w.b, w.a)).toBe("denied");
      expect(await snapshot(w)).toEqual(before);
    });

    it("add an item into Event B's category", async () => {
      const w = await world();
      const before = await snapshot(w);
      signedIn = as(w);
      const outcome = await action(() =>
        createItemAction(w.eventA, idle, form(itemFields(w.b.categoryId, "Smuggled"))),
      );
      expect(outcome).toBe("denied");
      expect(await snapshot(w)).toEqual(before);
    });
  },
);