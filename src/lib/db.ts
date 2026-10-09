// src/lib/db.ts
// Server-only Prisma client. Prisma 7 talks to Postgres through the pg driver adapter.
// Runtime uses DATABASE_URL (Supabase pooled connection); the Prisma CLI uses DIRECT_URL through
// prisma.config.ts. Prisma connects directly and bypasses Supabase row-level security, so every
// caller must authorize first (PROJECT_RULES section 7).
import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { parseServerEnv } from "./env.server";

/** Builds a client for one connection string. Tests use this with their own database. */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// One client per server process. In development, Next.js hot reload re-evaluates modules, so the
// client is kept on globalThis to avoid opening a new pool on every reload.
const globalForPrisma = globalThis as unknown as { eventOpsPrisma?: PrismaClient };

/**
 * The shared client. Created on first use, not on import, so `next build` and tests that never
 * touch the database do not need DATABASE_URL. Throws if the server environment is invalid.
 */
export function getDb(): PrismaClient {
  if (!globalForPrisma.eventOpsPrisma) {
    const { DATABASE_URL } = parseServerEnv(process.env);
    globalForPrisma.eventOpsPrisma = createPrismaClient(DATABASE_URL);
  }
  return globalForPrisma.eventOpsPrisma;
}