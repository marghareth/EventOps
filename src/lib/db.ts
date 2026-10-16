// src/lib/db.ts
// The runtime Prisma client (Prisma 7 with a driver adapter). Server only. The connection URL
// comes from DATABASE_URL, which must be the Supabase POOLED connection (Supavisor, transaction
// mode) because Vercel is serverless; migrations use the direct URL from prisma.config.ts.
//
// The client is created on first use, not on import, so `next build` works without a database.
// In development one client is kept on globalThis so hot reloads do not open new connections.
//
// ASSUMPTIONS: the `@prisma/adapter-pg` package is installed (Prisma 7 needs an adapter), and the
// generated client is at src/generated/prisma (the generator's output in schema.prisma).
import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForDb = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export function getDb(): PrismaClient {
  globalForDb.prisma ??= createClient();
  return globalForDb.prisma;
}

/** The shared client. Resolves the real one on first property access. */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getDb();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});