// src/lib/user-record.ts
// Keeps public.users in step with Supabase Auth (D-009, D-016). Called after a successful
// sign-in or email confirmation, never from the browser.
import type { PrismaClient } from "@/generated/prisma/client";

export type UserRecordInput = { id: string; email: string; displayName: string };

/**
 * Creates the users row on first sign-in. On later sign-ins it updates the email (it can change in
 * Supabase) but keeps the stored display name, which the user may have edited.
 */
export async function upsertUserRecord(db: PrismaClient, input: UserRecordInput) {
  return db.user.upsert({
    where: { id: input.id },
    create: { id: input.id, email: input.email, displayName: input.displayName },
    update: { email: input.email },
  });
}