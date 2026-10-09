// vitest.db.config.ts
// Database integration tests (`npm run test:db`). Needs TEST_DATABASE_URL pointing at a migrated
// test database. Kept separate so `npm test` never needs a database.
import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Next.js reads .env.local, so load it here for local runs too. Real env vars win (CI).
config({ path: ".env.local", quiet: true });

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "vitest.server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    // One database, shared rows: run files one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});