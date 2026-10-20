// src/lib/db.ts
// The runtime Prisma client (Prisma 7 with a driver adapter). Server only. The connection URL
// comes from DATABASE_URL, which must be the Supabase POOLED connection (Supavisor, transaction
// mode) because Vercel is serverless; migrations use the direct URL from prisma.config.ts.
//
// The client is created on first use, not on import, so `next build` works without a database.
// In development one client is kept on globalThis so hot reloads do not open new connections.
// The server environment is validated (src/lib/env.server.ts) before the first client is built.
//
// createPrismaClient(url) builds a client for an explicit URL. Database tests use it with
// TEST_DATABASE_URL; the app uses getDb() / db.
import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { parseServerEnv } from "./env.server";

const globalForDb = globalThis as unknown as { eventOpsPrisma?: PrismaClient };

/** A new client for `connectionString`. Does not connect until the first query. */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** The shared client. Throws a validation error when DATABASE_URL or DIRECT_URL is missing. */
export function getDb(): PrismaClient {
  globalForDb.eventOpsPrisma ??= createPrismaClient(parseServerEnv(process.env).DATABASE_URL);
  return globalForDb.eventOpsPrisma;
}

/** The shared client. Resolves the real one on first property access. */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getDb();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});