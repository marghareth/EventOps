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