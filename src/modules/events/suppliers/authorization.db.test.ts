// src/modules/events/suppliers/authorization.db.test.ts
// Supplier security checkpoint (B4-03 onwards, D-068, D-070, D-071). One matrix: every caller tries every
// supplier operation through the real server actions and reads, the way a crafted request would,
// with no page in between, against PostgreSQL. Allowed operations succeed; denied ones fail, change
// nothing in either event and add nothing to Activity.
//
//   Owner of A        → everything
//   Coordinator of A  → everything (suppliers.manage)
//   Viewer of A       → reads the supplier list and details, including contacts (D-068), but not
//                       their Activity; the edit form and
//                       every write (add, edit, remove; quotes) denied
//   User B (owner of Event B) on Event A → everything denied
//   Signed out        → everything denied
//
// Suppliers have no Owner-only operation (docs/PERMISSIONS.md), so there is no Coordinator-denied
// case. A second matrix sends Event B's supplier through Event A's address (a substituted ID):
// refused for every caller. Only the signed-in identity is mocked.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
const { createSupplier } = await import("./create-supplier");
const { createQuote } = await import("./create-quote");
const { createPayment } = await import("./create-payment");
const { createSupplierAction, deleteSupplierAction, updateSupplierAction } =
  await import("./actions");
const {
  getEventSuppliers,
  getPaymentFormContext,
  getQuoteForEditing,
  getSupplierDetail,
  getSupplierForEditing,
} = await import("./read");
const { DEFAULT_SUPPLIER_QUERY } = await import("./supplier-list-query");
const { createPaymentAction, updatePaymentAction } = await import("./payment-actions");
const { initialPaymentFormState } = await import("./payment-form-state");
const { createQuoteAction, updateQuoteAction } = await import("./quote-actions");
const { initialQuoteFormState } = await import("./quote-form-state");
const { initialSupplierFormState } = await import("./form-state");

const YEAR = 2080;
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

const SUPPLIER = {
  name: "Garden Kitchen",
  category: "CATERING" as const,
  categoryDetail: null,
  contactName: "Liza Tan",
  email: "liza@gardenkitchen.ph",
  phone: "0917 555 0101",
  notes: "Private arrangement",
};

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

type World = {
  owner: User;
  userB: User;
  coordinator: User;
  viewer: User;
  eventA: string;
  eventB: string;
  supplierA: string;
  supplierB: string;
  /** A Pending quote of each supplier, when the world was made with quotes (B4-10). */
  quoteA: string;
  quoteB: string;
  /** An unpaid payment of each supplier, when the world was made with quotes (B4-14). */
  paymentA: string;
  paymentB: string;
};

async function world(withQuotes = false): Promise<World> {
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
  const a = await createSupplier(db, { eventId: eventA, creatorId: owner.id, supplier: SUPPLIER });
  const b = await createSupplier(db, { eventId: eventB, creatorId: userB.id, supplier: SUPPLIER });
  if (!a.ok || !b.ok) throw new Error("setup failed");
  const addQuote = async (eventId: string, supplierId: string, creatorId: string) => {
    if (!withQuotes) return "";
    const created = await createQuote(db, {
      eventId,
      supplierId,
      creatorId,
      quote: { amount: "180000.00", status: "PENDING", description: null },
    });
    if (!created.ok) throw new Error("setup failed");
    return created.quote.id;
  };
  const addPayment = async (eventId: string, supplierId: string, creatorId: string) => {
    if (!withQuotes) return "";
    const created = await createPayment(db, {
      eventId,
      supplierId,
      creatorId,
      payment: {
        kind: "DEPOSIT",
        amount: "49500.00",
        dueDate: "2026-10-05",
        status: "UNPAID",
        paidOn: null,
        description: null,
      },
    });
    if (!created.ok) throw new Error("setup failed");
    return created.payment.id;
  };
  return {
    quoteA: await addQuote(eventA, a.supplier.id, owner.id),
    quoteB: await addQuote(eventB, b.supplier.id, userB.id),
    paymentA: await addPayment(eventA, a.supplier.id, owner.id),
    paymentB: await addPayment(eventB, b.supplier.id, userB.id),
    owner,
    userB,
    coordinator,
    viewer,
    eventA,
    eventB,
    supplierA: a.supplier.id,
    supplierB: b.supplier.id,
  };
}

/** Everything an operation could change, in both events. */
async function snapshot(w: World) {
  const where = { eventId: { in: [w.eventA, w.eventB] } };
  return {
    suppliers: await db.supplier.findMany({ where, orderBy: { id: "asc" } }),
    quotes: await db.supplierQuote.findMany({ where, orderBy: { id: "asc" } }),
    payments: await db.supplierPayment.findMany({ where, orderBy: { id: "asc" } }),
    counters: await db.event.findMany({
      where: { id: { in: [w.eventA, w.eventB] } },
      select: {
        id: true,
        lastSupplierNumber: true,
        lastQuoteNumber: true,
        lastPaymentNumber: true,
      },
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

const EMPTY_CONTACT = { contactName: "", email: "", phone: "", notes: "" };

/** The version the edit form would carry for a supplier. */
async function versionOf(supplierId: string) {
  const row = await db.supplier.findUniqueOrThrow({ where: { id: supplierId } });
  return row.updatedAt.toISOString();
}

const OPERATIONS = {
  "read the supplier list": (_w: World, eventId: string) => read(() => getEventSuppliers(eventId)),
  "open the supplier's details": (_w: World, eventId: string, supplierId: string) =>
    read(() => getSupplierDetail(eventId, supplierId)),
  "open the edit form": (_w: World, eventId: string, supplierId: string) =>
    read(() => getSupplierForEditing(eventId, supplierId)),
  "edit a supplier": async (_w: World, eventId: string, supplierId: string) => {
    const version = await versionOf(supplierId);
    return action(() =>
      updateSupplierAction(
        eventId,
        supplierId,
        initialSupplierFormState,
        form({
          name: "Renamed Kitchen",
          category: "CATERING",
          categoryDetail: "",
          ...EMPTY_CONTACT,
          version,
        }),
      ),
    );
  },
  "remove a supplier": (_w: World, eventId: string, supplierId: string) =>
    action(() => deleteSupplierAction(eventId, supplierId)),
  "add a quote": (_w: World, eventId: string, supplierId: string) =>
    action(() =>
      createQuoteAction(
        eventId,
        supplierId,
        initialQuoteFormState,
        form({ amount: "45,000", status: "PENDING", description: "" }),
      ),
    ),
  "open the quote edit form": (_w: World, eventId: string, supplierId: string, quoteId: string) =>
    read(() => getQuoteForEditing(eventId, supplierId, quoteId)),
  "edit a quote": async (_w: World, eventId: string, supplierId: string, quoteId: string) => {
    const quote = await db.supplierQuote.findUniqueOrThrow({ where: { id: quoteId } });
    return action(() =>
      updateQuoteAction(
        eventId,
        supplierId,
        quoteId,
        initialQuoteFormState,
        form({
          amount: "165,000",
          status: "ACCEPTED",
          description: "",
          version: quote.updatedAt.toISOString(),
        }),
      ),
    );
  },
  "open the add-payment form": (_w: World, eventId: string, supplierId: string) =>
    read(() => getPaymentFormContext(eventId, supplierId, null)),
  "add a payment": (_w: World, eventId: string, supplierId: string) =>
    action(() =>
      createPaymentAction(
        eventId,
        supplierId,
        initialPaymentFormState,
        form({
          kind: "PAYMENT",
          amount: "115,500",
          dueDate: "2026-12-05",
          status: "UNPAID",
          paidOn: "",
          description: "",
        }),
      ),
    ),
  "open the payment edit form": (
    _w: World,
    eventId: string,
    supplierId: string,
    _quoteId: string,
    paymentId: string,
  ) => read(() => getPaymentFormContext(eventId, supplierId, paymentId)),
  "edit a payment": async (
    _w: World,
    eventId: string,
    supplierId: string,
    _quoteId: string,
    paymentId: string,
  ) => {
    const stored = await db.supplierPayment.findUniqueOrThrow({ where: { id: paymentId } });
    return action(() =>
      updatePaymentAction(
        eventId,
        supplierId,
        paymentId,
        initialPaymentFormState,
        form({
          kind: "DEPOSIT",
          amount: "49,500",
          dueDate: "2026-10-05",
          status: "PAID",
          paidOn: "2026-10-03",
          description: "",
          version: stored.updatedAt.toISOString(),
        }),
      ),
    );
  },
  "add a supplier": (_w: World, eventId: string) =>
    action(() =>
      createSupplierAction(
        eventId,
        initialSupplierFormState,
        form({
          name: "Loud Studio",
          category: "SOUND_AND_LIGHTS",
          categoryDetail: "",
          contactName: "",
          email: "",
          phone: "",
          notes: "",
        }),
      ),
    ),
} satisfies Record<
  string,
  (
    w: World,
    eventId: string,
    supplierId: string,
    quoteId: string,
    paymentId: string,
  ) => Promise<Outcome>
>;

type Operation = keyof typeof OPERATIONS;
const ALL = Object.keys(OPERATIONS) as Operation[];

const CALLERS: { name: string; as: (w: World) => User | null; allowed: Operation[] }[] = [
  { name: "Owner of A", as: (w) => w.owner, allowed: ALL },
  { name: "Coordinator of A", as: (w) => w.coordinator, allowed: ALL },
  {
    name: "Viewer of A",
    as: (w) => w.viewer,
    allowed: ["read the supplier list", "open the supplier's details"],
  },
  { name: "User B (owner of Event B)", as: (w) => w.userB, allowed: [] },
  { name: "Signed out", as: () => null, allowed: [] },
];

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

describe.each(CALLERS)("$name on Event A", ({ as, allowed }) => {
  it.each(ALL)("%s", async (operation) => {
    const w = await world(true);
    const expected: Outcome = allowed.includes(operation) ? "allowed" : "denied";
    const before = await snapshot(w);
    signedIn = as(w);
    expect(await OPERATIONS[operation](w, w.eventA, w.supplierA, w.quoteA, w.paymentA)).toBe(
      expected,
    );
    signedIn = null;
    if (expected === "denied") expect(await snapshot(w)).toEqual(before);
  });
});

/** Operations on one supplier, given Event B's supplier inside Event A's address. */
const SUPPLIER_OPERATIONS: Operation[] = [
  "open the add-payment form",
  "add a payment",
  "open the payment edit form",
  "edit a payment",
  "open the supplier's details",
  "open the edit form",
  "edit a supplier",
  "remove a supplier",
  "add a quote",
  "open the quote edit form",
  "edit a quote",
];

describe.each(CALLERS)("$name with Event B's supplier in Event A's address", ({ as }) => {
  it.each(SUPPLIER_OPERATIONS)("%s is refused", async (operation) => {
    const w = await world(true);
    const before = await snapshot(w);
    signedIn = as(w);
    expect(await OPERATIONS[operation](w, w.eventA, w.supplierB, w.quoteB, w.paymentB)).toBe(
      "denied",
    );
    signedIn = null;
    expect(await snapshot(w)).toEqual(before);
  });
});

it("adds the supplier to the current event only, and lists it there (B4-03)", async () => {
  const w = await world();
  signedIn = w.coordinator;
  await action(() =>
    createSupplierAction(
      w.eventA,
      initialSupplierFormState,
      form({
        name: "Loud Studio",
        category: "SOUND_AND_LIGHTS",
        categoryDetail: "",
        contactName: "",
        email: "",
        phone: "",
        notes: "",
        eventId: w.eventB,
      }),
    ),
  );
  expect(await db.supplier.count({ where: { eventId: w.eventB } })).toBe(1);
  const list = await getEventSuppliers(w.eventA);
  expect(list.ok && list.suppliers.map((s) => s.name)).toEqual(["Garden Kitchen", "Loud Studio"]);
});

it("saves an edit to the current event's supplier only, and records it in Activity (B4-04)", async () => {
  const w = await world();
  signedIn = w.coordinator;
  const outcome = await action(async () =>
    updateSupplierAction(
      w.eventA,
      w.supplierA,
      initialSupplierFormState,
      form({
        name: "Garden Kitchen PH",
        category: "OTHER",
        categoryDetail: "Food trucks",
        ...EMPTY_CONTACT,
        version: await versionOf(w.supplierA),
        eventId: w.eventB,
      }),
    ),
  );
  expect(outcome).toBe("allowed");
  const a = await db.supplier.findUniqueOrThrow({ where: { id: w.supplierA } });
  expect(a).toMatchObject({ eventId: w.eventA, number: 1, name: "Garden Kitchen PH", email: null });
  expect((await db.supplier.findUniqueOrThrow({ where: { id: w.supplierB } })).name).toBe(
    "Garden Kitchen",
  );
  const entry = await db.auditLog.findFirst({
    where: { eventId: w.eventA, action: "supplier.updated" },
  });
  expect(entry).toMatchObject({ actorId: w.coordinator.id, entityId: w.supplierA });
  expect(JSON.stringify(entry?.details)).not.toContain("liza@gardenkitchen.ph");
});

it("refuses a stale edit and a malformed supplier ID, saving nothing", async () => {
  const w = await world();
  signedIn = w.owner;
  const before = await snapshot(w);
  const fields = { name: "Too late", category: "CATERING", categoryDetail: "", ...EMPTY_CONTACT };
  const stale = await updateSupplierAction(
    w.eventA,
    w.supplierA,
    initialSupplierFormState,
    form({ ...fields, version: "2000-01-01T00:00:00.000Z" }),
  );
  expect(stale).toMatchObject({
    status: "error",
    message: expect.stringMatching(/changed since you opened it/),
  });
  const malformed = await updateSupplierAction(
    w.eventA,
    "SUP-0001",
    initialSupplierFormState,
    form({ ...fields, version: await versionOf(w.supplierA) }),
  );
  expect(malformed).toMatchObject({
    status: "error",
    message: expect.stringMatching(/isn't available/),
  });
  expect(await snapshot(w)).toEqual(before);
});

it("refuses invalid input on the server, saving nothing", async () => {
  const w = await world();
  signedIn = w.owner;
  const before = await snapshot(w);
  const result = await createSupplierAction(
    w.eventA,
    initialSupplierFormState,
    form({
      name: " ",
      category: "DRONES",
      categoryDetail: "",
      contactName: "",
      email: "liza@",
      phone: "",
      notes: "",
    }),
  );
  expect(result).toMatchObject({
    status: "error",
    fieldErrors: {
      name: "Enter the supplier's name.",
      category: "Choose what the supplier provides.",
      email: "Enter an email like name@example.com.",
    },
  });
  expect(await snapshot(w)).toEqual(before);
});

it("lets a Viewer read contact details and notes (D-068), and says they can't change anything", async () => {
  const w = await world();
  signedIn = w.viewer;
  const result = await getEventSuppliers(w.eventA);
  expect(result).toMatchObject({
    ok: true,
    canManage: false,
    suppliers: [
      expect.objectContaining({ email: "liza@gardenkitchen.ph", notes: "Private arrangement" }),
    ],
  });
  expect(JSON.stringify(result)).not.toContain(w.supplierB);
});

it("removes the current event's supplier only, keeping a note in Activity (B4-05)", async () => {
  const w = await world();
  signedIn = w.coordinator;
  expect(await action(() => deleteSupplierAction(w.eventA, w.supplierA))).toBe("allowed");
  expect(await db.supplier.findUnique({ where: { id: w.supplierA } })).toBeNull();
  expect(await db.supplier.findUnique({ where: { id: w.supplierB } })).not.toBeNull();
  expect(
    await db.auditLog.findFirst({ where: { eventId: w.eventA, action: "supplier.deleted" } }),
  ).toMatchObject({ actorId: w.coordinator.id, details: { reference: "SUP-0001" } });
});

it("refuses a malformed supplier ID and a supplier already removed, removing nothing", async () => {
  const w = await world();
  signedIn = w.owner;
  const before = await snapshot(w);
  expect(await deleteSupplierAction(w.eventA, "SUP-0001")).toMatchObject({
    status: "error",
    message: expect.stringMatching(/isn't available/),
  });
  expect(await snapshot(w)).toEqual(before);
  await action(() => deleteSupplierAction(w.eventA, w.supplierA));
  expect(await deleteSupplierAction(w.eventA, w.supplierA)).toMatchObject({
    status: "error",
    message: expect.stringMatching(/may have been removed/),
  });
});

it("shows a supplier's own Activity to Owners and Coordinators only (B4-07)", async () => {
  const w = await world();
  // A second supplier in Event A: its entries must not appear on the first one's page.
  const other = await createSupplier(db, {
    eventId: w.eventA,
    creatorId: w.owner.id,
    supplier: { ...SUPPLIER, name: "Loud Studio" },
  });
  if (!other.ok) throw new Error("setup failed");

  for (const user of [w.owner, w.coordinator]) {
    signedIn = user;
    const detail = await getSupplierDetail(w.eventA, w.supplierA);
    expect(detail).toMatchObject({ ok: true, canManage: true, supplier: { id: w.supplierA } });
    const activity = detail.ok ? (detail.activity ?? []) : [];
    expect(activity.map((e) => e.action)).toEqual(["supplier.created"]);
    expect(JSON.stringify(activity)).not.toContain("Loud Studio");
  }

  signedIn = w.viewer;
  expect(await getSupplierDetail(w.eventA, w.supplierA)).toMatchObject({
    ok: true,
    canManage: false,
    activity: null,
    supplier: { email: "liza@gardenkitchen.ph" },
  });
});

it("adds a quote to the current event's supplier only, ignoring IDs in the form (B4-09)", async () => {
  const w = await world();
  signedIn = w.coordinator;
  const outcome = await action(() =>
    createQuoteAction(
      w.eventA,
      w.supplierA,
      initialQuoteFormState,
      form({
        amount: "165,000.50",
        status: "ACCEPTED",
        description: "Buffet",
        eventId: w.eventB,
        supplierId: w.supplierB,
      }),
    ),
  );
  expect(outcome).toBe("allowed");
  const quotes = await db.supplierQuote.findMany();
  const mine = quotes.filter((q) => q.eventId === w.eventA || q.eventId === w.eventB);
  expect(mine).toHaveLength(1);
  expect(mine[0]).toMatchObject({ eventId: w.eventA, supplierId: w.supplierA, status: "ACCEPTED" });
  expect(mine[0].amount.toFixed(2)).toBe("165000.50");
  const detail = await getSupplierDetail(w.eventA, w.supplierA);
  expect(detail.ok && detail.quotes.map((q) => q.amount)).toEqual(["165000.50"]);
  expect(detail.ok && detail.activity?.map((e) => e.action)).toEqual([
    "quote.created",
    "supplier.created",
  ]);
});

it("refuses invalid quote input and a second Accepted quote on the server, saving nothing", async () => {
  const w = await world();
  signedIn = w.owner;
  const before = await snapshot(w);
  expect(
    await createQuoteAction(
      w.eventA,
      w.supplierA,
      initialQuoteFormState,
      form({ amount: "-5,000", status: "MAYBE", description: "" }),
    ),
  ).toMatchObject({
    status: "error",
    fieldErrors: {
      amount: "Enter an amount more than ₱0.",
      status: "Choose the quote's status.",
    },
  });
  expect(await snapshot(w)).toEqual(before);

  const accepted = form({ amount: "1000", status: "ACCEPTED", description: "" });
  await action(() => createQuoteAction(w.eventA, w.supplierA, initialQuoteFormState, accepted));
  const afterFirst = await snapshot(w);
  expect(
    await createQuoteAction(
      w.eventA,
      w.supplierA,
      initialQuoteFormState,
      form({ amount: "2000", status: "ACCEPTED", description: "" }),
    ),
  ).toMatchObject({
    status: "error",
    fieldErrors: {
      status:
        "QUO-0001 is already accepted for this supplier. Change it to Pending or Declined first.",
    },
  });
  expect(await snapshot(w)).toEqual(afterFirst);
});

it("can't open or edit a quote through the wrong supplier or event (B4-10)", async () => {
  const w = await world(true);
  const sibling = await createSupplier(db, {
    eventId: w.eventA,
    creatorId: w.owner.id,
    supplier: { ...SUPPLIER, name: "Loud Studio" },
  });
  if (!sibling.ok) throw new Error("setup failed");
  signedIn = w.owner;
  const before = await snapshot(w);
  // Event A's supplier with Event B's quote; Event A's quote under another Event A supplier.
  for (const [supplierId, quoteId] of [
    [w.supplierA, w.quoteB],
    [sibling.supplier.id, w.quoteA],
  ]) {
    expect(await OPERATIONS["open the quote edit form"](w, w.eventA, supplierId, quoteId)).toBe(
      "denied",
    );
    expect(await OPERATIONS["edit a quote"](w, w.eventA, supplierId, quoteId)).toBe("denied");
  }
  expect(await snapshot(w)).toEqual(before);
});

it("saves a quote edit, refuses a stale one, and says when nothing changed (B4-10)", async () => {
  const w = await world(true);
  signedIn = w.coordinator;
  const quote = await db.supplierQuote.findUniqueOrThrow({ where: { id: w.quoteA } });
  const version = quote.updatedAt.toISOString();
  const send = (fields: Record<string, string>) =>
    updateQuoteAction(w.eventA, w.supplierA, w.quoteA, initialQuoteFormState, form(fields));
  expect(await send({ amount: "180,000", status: "PENDING", description: "", version })).toEqual({
    status: "success",
    message: "No changes to save.",
  });
  expect(
    await action(() =>
      send({
        amount: "175,000.25",
        status: "DECLINED",
        description: "Plated",
        supplierId: w.supplierB,
        version,
      }),
    ),
  ).toBe("allowed");
  const saved = await db.supplierQuote.findUniqueOrThrow({ where: { id: w.quoteA } });
  expect(saved).toMatchObject({
    supplierId: w.supplierA,
    status: "DECLINED",
    description: "Plated",
  });
  expect(saved.amount.toFixed(2)).toBe("175000.25");
  const before = await snapshot(w);
  expect(await send({ amount: "1", status: "PENDING", description: "", version })).toMatchObject({
    status: "error",
    message: expect.stringMatching(/changed since you opened it/),
  });
  expect(await snapshot(w)).toEqual(before);
});

it("can't open or edit a payment through the wrong supplier or event (B4-14)", async () => {
  const w = await world(true);
  const sibling = await createSupplier(db, {
    eventId: w.eventA,
    creatorId: w.owner.id,
    supplier: { ...SUPPLIER, name: "Loud Studio" },
  });
  if (!sibling.ok) throw new Error("setup failed");
  signedIn = w.owner;
  const before = await snapshot(w);
  for (const [supplierId, paymentId] of [
    [w.supplierA, w.paymentB],
    [sibling.supplier.id, w.paymentA],
  ]) {
    for (const operation of ["open the payment edit form", "edit a payment"] as const) {
      expect(await OPERATIONS[operation](w, w.eventA, supplierId, "", paymentId)).toBe("denied");
    }
  }
  expect(await snapshot(w)).toEqual(before);
});

it("refuses invalid amounts and dates on the server, saving nothing (B4-14)", async () => {
  const w = await world(true);
  signedIn = w.coordinator;
  const before = await snapshot(w);
  const result = await createPaymentAction(
    w.eventA,
    w.supplierA,
    initialPaymentFormState,
    form({
      kind: "DEPOSIT",
      amount: "-1",
      dueDate: "2026-02-30",
      status: "PAID",
      paidOn: "2999-01-01",
      description: "",
    }),
  );
  expect(result).toMatchObject({
    status: "error",
    fieldErrors: {
      amount: "Enter an amount more than ₱0.",
      dueDate: "Enter a real date, for example 2026-11-15.",
      paidOn: "Enter a date from Jan 1, 2000 to Dec 31, 2100.",
    },
  });
  // A paid date after today in Manila is refused by the server's own clock.
  const tomorrow = new Date(Date.now() + 8 * 3_600_000 + 86_400_000).toISOString().slice(0, 10);
  expect(
    await createPaymentAction(
      w.eventA,
      w.supplierA,
      initialPaymentFormState,
      form({
        kind: "DEPOSIT",
        amount: "100",
        dueDate: "2026-10-05",
        status: "PAID",
        paidOn: tomorrow,
        description: "",
      }),
    ),
  ).toMatchObject({ fieldErrors: { paidOn: "The paid date can't be in the future." } });
  expect(await snapshot(w)).toEqual(before);
});

it("saves a payment as paid, ignoring IDs in the form, and shows it on the supplier's page (B4-14)", async () => {
  const w = await world(true);
  signedIn = w.owner;
  const stored = await db.supplierPayment.findUniqueOrThrow({ where: { id: w.paymentA } });
  expect(await OPERATIONS["edit a payment"](w, w.eventA, w.supplierA, w.quoteA, w.paymentA)).toBe(
    "allowed",
  );
  const saved = await db.supplierPayment.findUniqueOrThrow({ where: { id: w.paymentA } });
  expect(saved).toMatchObject({ supplierId: w.supplierA, status: "PAID" });
  expect(saved.updatedAt.getTime()).toBeGreaterThan(stored.updatedAt.getTime());
  signedIn = w.viewer;
  const detail = await getSupplierDetail(w.eventA, w.supplierA);
  expect(detail).toMatchObject({
    ok: true,
    payments: [{ id: w.paymentA, status: "PAID", paidOn: "2026-10-03", dueStatus: "PAID" }],
    paymentSummary: { status: "NO_ACCEPTED_QUOTE", paid: "49500.00" },
    dueSummary: { overdueCount: 0, next: null },
  });
});

it("lists each supplier with its own event's quote and payment overview, for every member (B4-16)", async () => {
  const w = await world(true);
  // Event A: accept a quote and pay part of it; Event B's rows must not leak into Event A's list.
  await db.supplierQuote.update({ where: { id: w.quoteA }, data: { status: "ACCEPTED" } });
  await db.supplierPayment.update({
    where: { id: w.paymentA },
    data: { status: "PAID", paidOn: new Date("2026-10-04T00:00:00.000Z") },
  });
  await createPayment(db, {
    eventId: w.eventA,
    supplierId: w.supplierA,
    creatorId: w.owner.id,
    payment: {
      kind: "PAYMENT",
      amount: "130500.00",
      dueDate: "2099-12-01",
      status: "UNPAID",
      paidOn: null,
      description: null,
    },
  });
  for (const user of [w.owner, w.coordinator, w.viewer]) {
    signedIn = user;
    const result = await getEventSuppliers(w.eventA);
    expect(result).toMatchObject({
      ok: true,
      suppliers: [
        {
          id: w.supplierA,
          overview: {
            acceptedQuote: "180000.00",
            pendingQuotes: 0,
            paymentStatus: "PARTIALLY_PAID",
            due: { overdueCount: 0, next: { dueDate: "2099-12-01", dueStatus: "UPCOMING" } },
          },
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain(w.supplierB);
  }
  // Event B still sees its own unaccepted quote and overdue unpaid deposit.
  signedIn = w.userB;
  expect(await getEventSuppliers(w.eventB)).toMatchObject({
    ok: true,
    suppliers: [
      {
        id: w.supplierB,
        overview: {
          acceptedQuote: null,
          pendingQuotes: 1,
          paymentStatus: "NO_ACCEPTED_QUOTE",
          due: { overdueCount: 1, next: { dueDate: "2026-10-05", dueStatus: "OVERDUE" } },
        },
      },
    ],
  });
});

it("searches only the current event's suppliers, for members only (B4-17)", async () => {
  const w = await world();
  await createSupplier(db, {
    eventId: w.eventB,
    creatorId: w.userB.id,
    supplier: { ...SUPPLIER, name: "Only In Event B Sounds", contactName: "Bea Cruz" },
  });
  for (const user of [w.owner, w.coordinator, w.viewer]) {
    signedIn = user;
    for (const search of ["Only In Event B", "Bea Cruz", "SUP-0002"]) {
      const result = await getEventSuppliers(w.eventA, { ...DEFAULT_SUPPLIER_QUERY, search });
      expect(result).toMatchObject({ ok: true, suppliers: [], total: 1 });
    }
    const found = await getEventSuppliers(w.eventA, {
      ...DEFAULT_SUPPLIER_QUERY,
      search: "garden",
    });
    expect(found.ok && found.suppliers.map((s) => s.id)).toEqual([w.supplierA]);
  }
  // Not a member of Event A: refused before any search runs.
  signedIn = w.userB;
  expect(
    await read(() => getEventSuppliers(w.eventA, { ...DEFAULT_SUPPLIER_QUERY, search: "garden" })),
  ).toBe("denied");
  signedIn = null;
  expect(
    await read(() => getEventSuppliers(w.eventA, { ...DEFAULT_SUPPLIER_QUERY, search: "garden" })),
  ).toBe("denied");
});

it("filters only the current event's suppliers, composes filters, and clears back to all (B4-18)", async () => {
  const w = await world(true);
  // Event A: supplier A has a Pending quote and an overdue unpaid deposit (world); add a Venue
  // supplier with an Accepted quote and nothing due.
  const venue = await createSupplier(db, {
    eventId: w.eventA,
    creatorId: w.owner.id,
    supplier: { ...SUPPLIER, name: "Grand Hall", category: "VENUE" },
  });
  if (!venue.ok) throw new Error("setup failed");
  await createQuote(db, {
    eventId: w.eventA,
    supplierId: venue.supplier.id,
    creatorId: w.owner.id,
    quote: { amount: "250000.00", status: "ACCEPTED", description: null },
  });
  // Event B gets a Venue supplier with an Accepted quote too: it must never show up in Event A.
  const venueB = await createSupplier(db, {
    eventId: w.eventB,
    creatorId: w.userB.id,
    supplier: { ...SUPPLIER, name: "Grand Hall B", category: "VENUE" },
  });
  if (!venueB.ok) throw new Error("setup failed");
  await createQuote(db, {
    eventId: w.eventB,
    supplierId: venueB.supplier.id,
    creatorId: w.userB.id,
    quote: { amount: "1.00", status: "ACCEPTED", description: null },
  });

  signedIn = w.viewer;
  const ids = async (query: Partial<typeof DEFAULT_SUPPLIER_QUERY>) => {
    const result = await getEventSuppliers(w.eventA, { ...DEFAULT_SUPPLIER_QUERY, ...query });
    if (!result.ok) throw new Error("refused");
    expect(result.total).toBe(2);
    return result.suppliers.map((supplier) => supplier.id).sort();
  };
  const all = [w.supplierA, venue.supplier.id].sort();
  expect(await ids({ category: "VENUE" })).toEqual([venue.supplier.id]);
  expect(await ids({ quote: "accepted" })).toEqual([venue.supplier.id]);
  expect(await ids({ quote: "pending" })).toEqual([w.supplierA]);
  expect(await ids({ payment: "UNPAID" })).toEqual([venue.supplier.id]);
  expect(await ids({ payment: "NO_ACCEPTED_QUOTE" })).toEqual([w.supplierA]);
  expect(await ids({ overdue: true })).toEqual([w.supplierA]);
  expect(await ids({ category: "VENUE", overdue: true })).toEqual([]);
  expect(await ids({ category: "CATERING", quote: "pending", overdue: true })).toEqual([
    w.supplierA,
  ]);
  expect(await ids({})).toEqual(all);
});

// ───────────────────── Required supplier authorization cases (B4-19) ─────────────────────
// The seven cases the task names, each through the real server actions and reads (never the
// pages), against PostgreSQL. A denial must also leave both events unchanged.

const READS: Operation[] = ["read the supplier list", "open the supplier's details"];
const WRITES = ALL.filter((operation) => !READS.includes(operation));
const QUOTE_AND_PAYMENT = ALL.filter((op) => op.includes("quote") || op.includes("payment"));

type Target = { eventId: string; supplierId: string; quoteId: string; paymentId: string };

/**
 * Runs each operation in a fresh world (so one operation never changes what the next one sees) as
 * the given caller against the given target, and checks the outcome; a denial must leave both
 * events unchanged.
 */
async function expectEvery(
  userOf: (w: World) => User | null,
  operations: readonly Operation[],
  targetOf: (w: World) => Target,
  expected: Outcome,
) {
  for (const operation of operations) {
    const w = await world(true);
    const target = targetOf(w);
    const before = await snapshot(w);
    signedIn = userOf(w);
    const outcome = await OPERATIONS[operation](
      w,
      target.eventId,
      target.supplierId,
      target.quoteId,
      target.paymentId,
    );
    signedIn = null;
    expect({ operation, outcome }).toEqual({ operation, outcome: expected });
    if (expected === "denied") expect(await snapshot(w)).toEqual(before);
  }
}

const eventA = (w: World) => ({
  eventId: w.eventA,
  supplierId: w.supplierA,
  quoteId: w.quoteA,
  paymentId: w.paymentA,
});
const eventB = (w: World) => ({
  eventId: w.eventB,
  supplierId: w.supplierB,
  quoteId: w.quoteB,
  paymentId: w.paymentB,
});

describe("required supplier authorization cases (B4-19)", () => {
  it("1. User A → Event A supplier: allowed (reads and writes)", async () => {
    await expectEvery(
      (w) => w.owner,
      [...READS, "edit a supplier", "add a quote"],
      eventA,
      "allowed",
    );
  });

  it("2. User A → Event B supplier: denied, Event B unchanged", async () => {
    await expectEvery((w) => w.owner, ALL, eventB, "denied");
  });

  it("3. User B → Event A supplier: denied, Event A unchanged", async () => {
    await expectEvery((w) => w.userB, ALL, eventA, "denied");
  });

  it("4. Viewer supplier write: denied at the action boundary, nothing changed", async () => {
    await expectEvery((w) => w.viewer, READS, eventA, "allowed");
    await expectEvery((w) => w.viewer, WRITES, eventA, "denied");
    const w = await world(true);
    // The refusal comes from the role check before any storage is touched, with the role message,
    // not from the database's re-check (which would answer "not found").
    signedIn = w.viewer;
    const blank = form({});
    expect(await createSupplierAction(w.eventA, initialSupplierFormState, blank)).toMatchObject({
      message: expect.stringMatching(/can view suppliers but not change them/),
    });
    expect(
      await createQuoteAction(w.eventA, w.supplierA, initialQuoteFormState, blank),
    ).toMatchObject({ message: expect.stringMatching(/can view quotes but not change them/) });
    expect(
      await createPaymentAction(w.eventA, w.supplierA, initialPaymentFormState, blank),
    ).toMatchObject({ message: expect.stringMatching(/can view payments but not change them/) });
    expect(await deleteSupplierAction(w.eventA, w.supplierA)).toMatchObject({
      message: expect.stringMatching(/can view suppliers but not change them/),
    });
  });

  it("5. Coordinator permitted supplier operations: allowed", async () => {
    await expectEvery((w) => w.coordinator, ALL, eventA, "allowed");
  });

  it("6. Owner permitted operations: allowed", async () => {
    await expectEvery((w) => w.owner, ALL, eventA, "allowed");
  });

  it("7. Unauthorized quote and payment access: denied for every refused caller and cross-event ID", async () => {
    const writes = QUOTE_AND_PAYMENT;
    await expectEvery((w) => w.viewer, writes, eventA, "denied");
    await expectEvery((w) => w.userB, writes, eventA, "denied");
    await expectEvery(() => null, writes, eventA, "denied");
    await expectEvery((w) => w.owner, writes, eventB, "denied");
    // Event A's own supplier with Event B's quote and payment IDs.
    await expectEvery(
      (w) => w.owner,
      ["open the quote edit form", "edit a quote", "open the payment edit form", "edit a payment"],
      (w) => ({ ...eventA(w), quoteId: w.quoteB, paymentId: w.paymentB }),
      "denied",
    );
  });
});

it("8. a member of both events can't add a quote or payment to Event B's supplier through Event A (B4-19)", async () => {
  const w = await world(true);
  // The owner of Event A also owns Event B.
  await db.eventMember.create({ data: { eventId: w.eventB, userId: w.owner.id, role: "OWNER" } });
  const before = await snapshot(w);
  const quote = await createQuote(db, {
    eventId: w.eventA,
    supplierId: w.supplierB,
    creatorId: w.owner.id,
    quote: { amount: "1000.00", status: "PENDING", description: null },
  });
  const payment = await createPayment(db, {
    eventId: w.eventA,
    supplierId: w.supplierB,
    creatorId: w.owner.id,
    payment: {
      kind: "DEPOSIT",
      amount: "1000.00",
      dueDate: "2099-01-01",
      status: "UNPAID",
      paidOn: null,
      description: null,
    },
  });
  expect(quote).toEqual({ ok: false, reason: "not-found" });
  expect(payment).toEqual({ ok: false, reason: "not-found" });
  const after = await snapshot(w);
  expect(after.quotes).toEqual(before.quotes);
  expect(after.counters).toEqual(before.counters);
});