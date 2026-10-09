// src/lib/auth.ts
// Server-side authentication checks. Every protected page, server action and route handler must
// call one of these itself; hiding UI or the proxy redirect is not authorization.
//
//   Pages and server actions:  const user = await requireUser();          // redirects if signed out
//   Route handlers:            const user = await getCurrentUser();
//                              if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
//
// Event membership and role checks (later tasks) build on the returned user id.
import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { displayNameFor, loginUrlFor } from "./auth-rules";
import { getDb } from "./db";
import { createSupabaseServerClient } from "./supabase/server";
import { upsertUserRecord } from "./user-record";

/** The signed-in user as the rest of the app sees it. */
export type AuthUser = { id: string; email: string };

/** Thrown when Supabase Auth cannot be reached, so callers show an error page, not a login page. */
export class AuthUnavailableError extends Error {
  constructor() {
    super("Authentication service unavailable");
    this.name = "AuthUnavailableError";
  }
}

function toAuthUser(user: User): AuthUser {
  return { id: user.id, email: user.email ?? "" };
}

/**
 * Returns the verified signed-in user, or null when there is no valid session.
 * Uses getUser(), which asks Supabase Auth on every call, so signed-out, banned or deleted users
 * are rejected immediately (D-013). Throws AuthUnavailableError if Supabase cannot be reached.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    // 4xx: no session, expired or revoked token, deleted user. All mean "signed out".
    const status = error.status ?? 0;
    if (error.name === "AuthSessionMissingError" || (status >= 400 && status < 500)) return null;
    throw new AuthUnavailableError();
  }
  return data.user ? toAuthUser(data.user) : null;
}

/**
 * Returns the signed-in user or redirects to the login page. Pass the current path as `nextPath`
 * to return the user there after signing in.
 */
export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrlFor(nextPath));
  return user;
}

/** Creates or updates the users row for a freshly authenticated Supabase user. */
export async function syncUserRecord(user: User): Promise<void> {
  await upsertUserRecord(getDb(), {
    id: user.id,
    email: (user.email ?? "").toLowerCase(),
    displayName: displayNameFor(user),
  });
}