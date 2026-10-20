// e2e/lifecycle/db.ts
// Database helpers for the browser lifecycle test (B1-14). They stand in for the member management
// screens, which don't exist yet (D-034): an Owner's decision to add or change a member is applied
// directly. Test database only (checked).
import { randomUUID } from "node:crypto";
import pg from "pg";
import { DEMO_USER_ID, E2E_EMAIL_DOMAIN, assertTestDatabase } from "../../scripts/reset-demo";

type Role = "OWNER" | "COORDINATOR" | "VIEWER";

async function withClient<T>(work: (client: pg.Client) => Promise<T>): Promise<T> {
  const url = process.env.E2E_DATABASE_URL ?? "";
  assertTestDatabase(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

/** Adds another Owner, so the demo user can be given a lower role (every event keeps an Owner). */
export function addSecondOwner(eventId: string): Promise<void> {
  return withClient(async (client) => {
    const id = randomUUID();
    await client.query(`INSERT INTO users (id, email, "displayName") VALUES ($1, $2, $3)`, [
      id,
      `${id}@${E2E_EMAIL_DOMAIN}`,
      "Second Owner",
    ]);
    await client.query(
      `INSERT INTO event_members (id, "eventId", "userId", role) VALUES ($1, $2, $3, 'OWNER')`,
      [randomUUID(), eventId, id],
    );
  });
}

export function setDemoRole(eventId: string, role: Role): Promise<void> {
  return withClient(async (client) => {
    await client.query(
      `INSERT INTO event_members (id, "eventId", "userId", role) VALUES ($1, $2, $3, $4)
       ON CONFLICT ("eventId", "userId") DO UPDATE SET role = EXCLUDED.role`,
      [randomUUID(), eventId, DEMO_USER_ID, role],
    );
  });
}

export function removeDemoMembership(eventId: string): Promise<void> {
  return withClient(async (client) => {
    await client.query(`DELETE FROM event_members WHERE "eventId" = $1 AND "userId" = $2`, [
      eventId,
      DEMO_USER_ID,
    ]);
  });
}
// Supplier seed for the supplier workflow test (B4-22). A realistic Cebu wedding's suppliers,
// written straight to the test database the way the app stores them: SUP, QUO and PAY numbers
// continue from the event's counters, amounts are exact two-decimal strings, dates are calendar
// days relative to "today" in Manila, and at most one quote per supplier is Accepted. This stands in
// for months of planning so search and filters have something real to work on; the test's own
// changes still go through the screens. No audit entries are written for seeded rows.

type SeedQuote = {
  amount: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  description?: string;
};
type SeedPayment = {
  kind: "DEPOSIT" | "PAYMENT";
  amount: string;
  /** Days from today (negative is in the past). */
  dueIn: number;
  /** Days from today it was paid, or undefined when unpaid. */
  paidIn?: number;
  description?: string;
};
export type SeedSupplier = {
  name: string;
  category: string;
  categoryDetail?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  quotes?: SeedQuote[];
  payments?: SeedPayment[];
};

/** "YYYY-MM-DD" a number of days from a calendar day. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Adds suppliers to an event; returns each supplier's id by name. */
export function seedSuppliers(
  eventId: string,
  today: string,
  suppliers: readonly SeedSupplier[],
): Promise<Record<string, string>> {
  return withClient(async (client) => {
    const ids: Record<string, string> = {};
    await client.query("BEGIN");
    try {
      for (const supplier of suppliers) {
        const id = randomUUID();
        ids[supplier.name] = id;
        const { rows } = await client.query<{ n: number }>(
          `UPDATE events SET "lastSupplierNumber" = "lastSupplierNumber" + 1 WHERE id = $1
           RETURNING "lastSupplierNumber" AS n`,
          [eventId],
        );
        await client.query(
          `INSERT INTO suppliers (id, "eventId", number, name, category, "categoryDetail",
             "contactName", phone, email, "updatedAt")
           VALUES ($1, $2, $3, $4, $5::supplier_category, $6, $7, $8, $9, now())`,
          [
            id,
            eventId,
            rows[0].n,
            supplier.name,
            supplier.category,
            supplier.categoryDetail ?? null,
            supplier.contactName ?? null,
            supplier.phone ?? null,
            supplier.email ?? null,
          ],
        );
        for (const quote of supplier.quotes ?? []) {
          const { rows: q } = await client.query<{ n: number }>(
            `UPDATE events SET "lastQuoteNumber" = "lastQuoteNumber" + 1 WHERE id = $1
             RETURNING "lastQuoteNumber" AS n`,
            [eventId],
          );
          await client.query(
            `INSERT INTO supplier_quotes (id, "eventId", "supplierId", number, amount, status,
               description, "updatedAt")
             VALUES ($1, $2, $3, $4, $5::numeric, $6::quote_status, $7, now())`,
            [
              randomUUID(),
              eventId,
              id,
              q[0].n,
              quote.amount,
              quote.status,
              quote.description ?? null,
            ],
          );
        }
        for (const payment of supplier.payments ?? []) {
          const { rows: p } = await client.query<{ n: number }>(
            `UPDATE events SET "lastPaymentNumber" = "lastPaymentNumber" + 1 WHERE id = $1
             RETURNING "lastPaymentNumber" AS n`,
            [eventId],
          );
          const paid = payment.paidIn !== undefined;
          await client.query(
            `INSERT INTO supplier_payments (id, "eventId", "supplierId", number, kind, amount,
               "dueDate", status, "paidOn", description, "updatedAt")
             VALUES ($1, $2, $3, $4, $5::payment_kind, $6::numeric, $7::date,
               $8::payment_record_status, $9::date, $10, now())`,
            [
              randomUUID(),
              eventId,
              id,
              p[0].n,
              payment.kind,
              payment.amount,
              addDays(today, payment.dueIn),
              paid ? "PAID" : "UNPAID",
              paid ? addDays(today, payment.paidIn!) : null,
              payment.description ?? null,
            ],
          );
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    return ids;
  });
}

/** A supplier's quotes and payments exactly as stored (amounts and dates as text), for checking. */
export function storedSupplierMoney(eventId: string, supplierName: string) {
  return withClient(async (client) => {
    const quotes = await client.query<{ number: number; amount: string; status: string }>(
      `SELECT q.number, q.amount::text AS amount, q.status::text AS status
         FROM supplier_quotes q JOIN suppliers s ON s.id = q."supplierId"
        WHERE q."eventId" = $1 AND s.name = $2 ORDER BY q.number`,
      [eventId, supplierName],
    );
    const payments = await client.query<{
      kind: string;
      amount: string;
      dueDate: string;
      status: string;
      paidOn: string | null;
    }>(
      `SELECT p.kind::text AS kind, p.amount::text AS amount, p."dueDate"::text AS "dueDate",
              p.status::text AS status, p."paidOn"::text AS "paidOn"
         FROM supplier_payments p JOIN suppliers s ON s.id = p."supplierId"
        WHERE p."eventId" = $1 AND s.name = $2 ORDER BY p.number`,
      [eventId, supplierName],
    );
    return { quotes: quotes.rows, payments: payments.rows };
  });
}
/**
 * The Impact flow's starting point (B7, D-101): the brand book's wedding at 180 expected guests in a
 * 200-seat venue, a catering budget that is nearly used up, 8 accessible seats, and two open tasks,
 * one of which mentions catering. Written straight to the test database the way the app stores it;
 * the test's own changes still go through the screens.
 */
export function seedImpactScenario(eventId: string): Promise<void> {
  return withClient(async (client) => {
    await client.query(
      `UPDATE events SET capacity = 200, "expectedAttendees" = 180, "updatedAt" = now() WHERE id = $1`,
      [eventId],
    );
    const categories: [string, string, string][] = [
      ["Catering", "100000.00", "95000.00"],
      ["Venue", "250000.00", "205000.00"],
    ];
    let number = 0;
    for (const [name, allocation, committed] of categories) {
      const categoryId = randomUUID();
      number += 1;
      await client.query(
        `INSERT INTO budget_categories (id, "eventId", name, "allocationAmount", "updatedAt")
         VALUES ($1, $2, $3, $4, now())`,
        [categoryId, eventId, name, allocation],
      );
      await client.query(
        `INSERT INTO budget_items (id, "eventId", "categoryId", number, name, "estimatedAmount",
           "committedAmount", "paidAmount", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $6, '0.00', now())`,
        [randomUUID(), eventId, categoryId, number, `${name} contract`, committed],
      );
    }
    await client.query(`UPDATE events SET "lastBudgetItemNumber" = $2 WHERE id = $1`, [
      eventId,
      number,
    ]);
    await client.query(
      `INSERT INTO accessibility_resources (id, "eventId", type, status, quantity, "updatedAt")
       VALUES ($1, $2, 'ACCESSIBLE_SEATS', 'AVAILABLE', 8, now())`,
      [randomUUID(), eventId],
    );
    const tasks = ["Confirm catering headcount", "Print the programs"];
    for (const [index, title] of tasks.entries()) {
      await client.query(
        `INSERT INTO tasks (id, "eventId", number, title, priority, status, "updatedAt")
         VALUES ($1, $2, $3, $4, 'MEDIUM', 'NOT_STARTED', now())`,
        [randomUUID(), eventId, index + 1, title],
      );
    }
    await client.query(`UPDATE events SET "lastTaskNumber" = $2 WHERE id = $1`, [
      eventId,
      tasks.length,
    ]);
  });
}

/** The event's stored expected attendees and how many impact analyses it has. */
export function storedImpactState(eventId: string) {
  return withClient(async (client) => {
    const event = await client.query(`SELECT "expectedAttendees" FROM events WHERE id = $1`, [
      eventId,
    ]);
    const analyses = await client.query(
      `SELECT number, "fromAttendees", "toAttendees", "overallSeverity" FROM impact_analyses
       WHERE "eventId" = $1 ORDER BY number`,
      [eventId],
    );
    return {
      expectedAttendees: event.rows[0]?.expectedAttendees as number,
      analyses: analyses.rows as {
        number: number;
        fromAttendees: number;
        toAttendees: number;
        overallSeverity: string;
      }[],
    };
  });
}

/**
 * The Event Health flow's problems (B8, D-105): a guest who hasn't replied and has no contact, a
 * supplier with no Accepted quote and an overdue deposit, and an overdue High-priority task nobody is
 * assigned to. Written straight to the test database the way the app stores them.
 */
export function seedHealthProblems(eventId: string): Promise<void> {
  return withClient(async (client) => {
    await client.query(
      `INSERT INTO attendees (id, "eventId", number, name, "rsvpStatus", "plusOnes", "updatedAt")
       VALUES ($1, $2, 1, 'Remedios Cruz', 'PENDING', 0, now())`,
      [randomUUID(), eventId],
    );
    await client.query(`UPDATE events SET "lastAttendeeNumber" = 1 WHERE id = $1`, [eventId]);
    const supplierId = randomUUID();
    await client.query(
      `INSERT INTO suppliers (id, "eventId", number, name, category, phone, "updatedAt")
       VALUES ($1, $2, 1, 'Casa Verde Catering', 'CATERING', '0917 555 0101', now())`,
      [supplierId, eventId],
    );
    await client.query(
      `INSERT INTO supplier_payments (id, "eventId", "supplierId", number, kind, amount, "dueDate", "updatedAt")
       VALUES ($1, $2, $3, 1, 'DEPOSIT', '30000.00', DATE '2020-01-15', now())`,
      [randomUUID(), eventId, supplierId],
    );
    await client.query(
      `UPDATE events SET "lastSupplierNumber" = 1, "lastPaymentNumber" = 1 WHERE id = $1`,
      [eventId],
    );
    await client.query(
      `INSERT INTO tasks (id, "eventId", number, title, priority, status, "dueDate", "updatedAt")
       VALUES ($1, $2, 1, 'Sign the venue contract', 'HIGH', 'NOT_STARTED', DATE '2020-01-15', now())`,
      [randomUUID(), eventId],
    );
    await client.query(`UPDATE events SET "lastTaskNumber" = 1 WHERE id = $1`, [eventId]);
  });
}

/** The first attendee and supplier of an event, for opening their pages in the B10 review. */
export function firstRecordIds(eventId: string) {
  return withClient(async (client) => {
    const one = async (table: string) =>
      (
        await client.query(`SELECT id FROM ${table} WHERE "eventId" = $1 ORDER BY number LIMIT 1`, [
          eventId,
        ])
      ).rows[0]?.id as string | undefined;
    return {
      attendeeId: await one("attendees"),
      supplierId: await one("suppliers"),
      taskId: await one("tasks"),
    };
  });
}