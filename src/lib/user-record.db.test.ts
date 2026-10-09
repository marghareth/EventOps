// src/lib/user-record.db.test.ts
// Database tests for the users-row sync (B0-09). Run with `npm run test:db`.
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "./db";
import { upsertUserRecord } from "./user-record";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL is not set. See CONTRIBUTING.md, 'Database tests'.");
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test'.");
}

let db: PrismaClient;
const ids: string[] = [];

beforeAll(() => {
  db = createPrismaClient(url);
});
afterEach(async () => {
  await db.user.deleteMany({ where: { id: { in: ids.splice(0) } } });
});
afterAll(async () => {
  await db.$disconnect();
});

function newUser() {
  const id = randomUUID();
  ids.push(id);
  return { id, email: `${id}@example.test`, displayName: "Mika" };
}

describe("upsertUserRecord", () => {
  it("creates the users row on first sign-in", async () => {
    const input = newUser();
    await upsertUserRecord(db, input);
    await expect(db.user.findUnique({ where: { id: input.id } })).resolves.toMatchObject(input);
  });

  it("is safe to repeat: a second sign-in does not duplicate the row", async () => {
    const input = newUser();
    await upsertUserRecord(db, input);
    await upsertUserRecord(db, input);
    expect(await db.user.count({ where: { id: input.id } })).toBe(1);
  });

  it("updates the email but keeps the stored display name", async () => {
    const input = newUser();
    await upsertUserRecord(db, input);
    const newEmail = `new-${input.email}`;
    await upsertUserRecord(db, { ...input, email: newEmail, displayName: "Changed" });
    await expect(db.user.findUnique({ where: { id: input.id } })).resolves.toMatchObject({
      email: newEmail,
      displayName: "Mika",
    });
  });

  it("rejects a different Supabase user with an email already in use", async () => {
    const first = newUser();
    await upsertUserRecord(db, first);
    const second = { ...newUser(), email: first.email };
    await expect(upsertUserRecord(db, second)).rejects.toMatchObject({ code: "P2002" });
  });
});