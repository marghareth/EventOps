// e2e/lifecycle/global-setup.ts
// Starts every lifecycle run from the same state (B1-14): the demo user has no events.
import { resetDemoData } from "../../scripts/reset-demo";

export default async function globalSetup(): Promise<void> {
  const database = process.env.E2E_DATABASE_URL;
  if (!database) {
    throw new Error(
      "Set E2E_DATABASE_URL to a migrated test database (its name must contain 'test' or 'e2e'). See docs/TESTING.md.",
    );
  }
  await resetDemoData(database);
}