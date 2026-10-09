// prisma.config.ts
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local, so load it here for the Prisma CLI too.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // The CLI (migrate, validate) uses the direct, non-pooled connection.
  datasource: { url: process.env.DIRECT_URL ?? "" },
});