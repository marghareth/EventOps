// src/modules/events/suppliers/activity.db.test.ts
// Supplier activity through the one existing audit log (B4-20; D-037, D-070 to D-080). Every
// supplier, quote and payment change writes exactly one entry, with the right action, actor and
// record, in the same transaction; refused and unchanged saves write none; and no entry ever holds
// a contact person, email, phone or notes. Run with `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

const { createPrismaClient } = await import("@/lib/db");
const { createEvent } = await import("../create-event");
const { createSupplier } = await import("./create-supplier");
const { updateSupplier } = await import("./update-supplier");
const { deleteSupplier } = await import("./delete-supplier");
const { createQuote } = await import("./create-quote");
const { updateQuote } = await import("./update-quote");
const { createPayment } = await import("./create-payment");
const { updatePayment } = await import("./update-payment");
const { listAuditEntries, describeAuditEntry } = await import("@/modules/events/audit/public");

const YEAR = 2086;
let db: PrismaClient;
const userIds: string[] = [];

async function newUser() {
  const id = randomUUID();
  userIds.push(id);
  await db.user.create({ data: { id, email: `${id}@example.test`, displayName: "Mika" } });
  return id;
}

beforeAll(() => {
  db = createPrismaClient(url);
});
afterEach(async () => {
  await db.event.deleteMany({ where: { createdById: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  await db.eventReferenceCounter.deleteMany({ where: { year: YEAR } });
});
afterAll(async () => {
  await db.$disconnect();
});

const CONTACT = {
  contactName: "Liza Tan",
  email: "liza@gardenkitchen.ph",
  phone: "0917 555 0101",
  notes: "Tasting on Nov 3",
};

it("records one entry per supplier, quote and payment change, and never contact details", async () => {
  const owner = await newUser();
  const viewer = await newUser();
  const { id: eventId } = await createEvent(db, {
    event: {
      name: "Santos wedding",
      venue: null,
      description: null,
      startsAt: new Date(`${YEAR}-12-12T08:00:00Z`),
      endsAt: null,
      capacity: null,
      expectedAttendees: 0,
    },
    creatorId: owner,
    now: new Date(`${YEAR}-01-01`),
  });
  await db.eventMember.create({ data: { eventId, userId: viewer, role: "VIEWER" } });
  const count = () => db.auditLog.count({ where: { eventId } });
  const last = async () =>
    db.auditLog.findFirstOrThrow({
      where: { eventId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

  // Each step: the change, the action it must record, and the record it is about.
  const before = await count();
  const supplier = await createSupplier(db, {
    eventId,
    creatorId: owner,
    supplier: { name: "Garden Kitchen", category: "CATERING", categoryDetail: null, ...CONTACT },
  });
  if (!supplier.ok) throw new Error("setup failed");
  const supplierId = supplier.supplier.id;
  expect(await count()).toBe(before + 1);
  expect(await last()).toMatchObject({
    action: "supplier.created",
    actorId: owner,
    entityId: supplierId,
  });

  const stored = await db.supplier.findUniqueOrThrow({ where: { id: supplierId } });
  await updateSupplier(db, {
    eventId,
    supplierId,
    editorId: owner,
    version: stored.updatedAt,
    details: {
      name: "Garden Kitchen PH",
      category: "CATERING",
      categoryDetail: null,
      contactName: "Rico Mendoza",
      email: "rico@gardenkitchen.ph",
      phone: "0918 555 0102",
      notes: "Deposit by Nov 10",
    },
  });
  expect(await count()).toBe(before + 2);
  expect(await last()).toMatchObject({ action: "supplier.updated", entityId: supplierId });

  const quote = await createQuote(db, {
    eventId,
    supplierId,
    creatorId: owner,
    quote: { amount: "165000.00", status: "PENDING", description: null },
  });
  if (!quote.ok) throw new Error("setup failed");
  expect(await count()).toBe(before + 3);
  expect(await last()).toMatchObject({ action: "quote.created", entityId: quote.quote.id });

  const storedQuote = await db.supplierQuote.findUniqueOrThrow({ where: { id: quote.quote.id } });
  await updateQuote(db, {
    eventId,
    supplierId,
    quoteId: quote.quote.id,
    editorId: owner,
    version: storedQuote.updatedAt,
    quote: { amount: "165000.00", status: "ACCEPTED", description: null },
    now: new Date(),
  });
  expect(await count()).toBe(before + 4);
  const accepted = await last();
  expect(accepted).toMatchObject({ action: "quote.updated", entityId: quote.quote.id });
  expect(describeAuditEntry({ action: "quote.updated", details: accepted.details }).summary).toBe(
    "Accepted the quote QUO-0001 for SUP-0001",
  );

  const payment = await createPayment(db, {
    eventId,
    supplierId,
    creatorId: owner,
    payment: {
      kind: "DEPOSIT",
      amount: "49500.00",
      dueDate: "2026-10-05",
      status: "UNPAID",
      paidOn: null,
      description: null,
    },
  });
  if (!payment.ok) throw new Error("setup failed");
  expect(await count()).toBe(before + 5);
  expect(await last()).toMatchObject({ action: "payment.created", entityId: payment.payment.id });

  const storedPayment = await db.supplierPayment.findUniqueOrThrow({
    where: { id: payment.payment.id },
  });
  const paid = {
    kind: "DEPOSIT" as const,
    amount: "49500.00",
    dueDate: "2026-10-05",
    status: "PAID" as const,
    paidOn: "2026-10-04",
    description: null,
  };
  await updatePayment(db, {
    eventId,
    supplierId,
    paymentId: payment.payment.id,
    editorId: owner,
    version: storedPayment.updatedAt,
    payment: paid,
  });
  expect(await count()).toBe(before + 6);
  const marked = await last();
  expect(marked).toMatchObject({ action: "payment.updated", entityId: payment.payment.id });
  expect(describeAuditEntry({ action: "payment.updated", details: marked.details }).summary).toBe(
    "Marked the payment PAY-0001 for SUP-0001 as paid (Oct 4, 2026)",
  );

  // Refused and unchanged saves write nothing.
  const paidVersion = (
    await db.supplierPayment.findUniqueOrThrow({ where: { id: payment.payment.id } })
  ).updatedAt;
  await updatePayment(db, {
    eventId,
    supplierId,
    paymentId: payment.payment.id,
    editorId: owner,
    version: paidVersion,
    payment: paid,
  });
  await createQuote(db, {
    eventId,
    supplierId,
    creatorId: viewer,
    quote: { amount: "1.00", status: "PENDING", description: null },
  });
  await deleteSupplier(db, { eventId, supplierId, userId: viewer });
  expect(await count()).toBe(before + 6);

  await deleteSupplier(db, { eventId, supplierId, userId: owner });
  expect(await count()).toBe(before + 7);
  expect(await last()).toMatchObject({ action: "supplier.deleted", entityId: supplierId });

  // The one Activity feed shows them all, worded, and never a contact detail.
  const feed = await listAuditEntries(db, eventId);
  expect(feed.filter((entry) => entry.action === null)).toEqual([]);
  const text = JSON.stringify(feed.map((entry) => [entry.details, describeAuditEntry(entry)]));
  for (const value of [
    ...Object.values(CONTACT),
    "Rico Mendoza",
    "rico@gardenkitchen.ph",
    "0918 555 0102",
    "Deposit by Nov 10",
  ]) {
    expect(text).not.toContain(value);
  }
});