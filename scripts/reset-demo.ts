// scripts/reset-demo.ts
// Resets the dev demo user's data in a TEST database (B1-14), so browser tests start from the same
// state every time. Deletes every event the demo user created or belongs to (everything in them goes
// too, D-004) and the extra users the browser tests add. Event number counters are kept.
//
// Refuses to touch a database whose name doesn't contain "test" or "e2e". Runs automatically before
// every `npm run test:e2e:lifecycle` (e2e/lifecycle/global-setup.ts).
import pg from "pg";

/** The fixed dev demo user (src/lib/demo-auth.ts, D-024). */
export const DEMO_USER_ID = "00000000-0000-4000-8000-00000000d3e0";
/** Extra users created by browser tests use this email domain. */
export const E2E_EMAIL_DOMAIN = "e2e.eventops.test";

export function assertTestDatabase(connectionString: string): void {
  const name = new URL(connectionString).pathname.replace(/^\//, "");
  if (!/test|e2e/i.test(name)) {
    throw new Error(`Refusing to reset "${name}": the database name must contain "test" or "e2e".`);
  }
}

export async function resetDemoData(connectionString: string): Promise<void> {
  assertTestDatabase(connectionString);
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM events WHERE "createdById" = $1
         OR id IN (SELECT "eventId" FROM event_members WHERE "userId" = $1)`,
      [DEMO_USER_ID],
    );
    await client.query(
      `DELETE FROM events WHERE "createdById" IN (SELECT id FROM users WHERE email LIKE $1)`,
      [`%@${E2E_EMAIL_DOMAIN}`],
    );
    await client.query(`DELETE FROM users WHERE email LIKE $1`, [`%@${E2E_EMAIL_DOMAIN}`]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}