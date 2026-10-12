// src/modules/events/authorize.ts
// THE authorization pattern for every event operation (B1-09, D-036). Each server action and route
// handler that touches an event calls one of these first, before reading input it would act on:
//
//   Server action:  const auth = await authorizeEvent(eventId, "tasks.manage", returnPath);
//                   if (!auth.ok) return { status: "error", message: MESSAGES[auth.reason] };
//                   ... use auth.user.id and auth.event.id, never IDs from the form ...
//
//   Route handler:  const auth = await authorizeEventRequest(eventId, "attendees.export");
//                   if (!auth.ok) return auth.response;
//
//   Page:           const { access } = await requireEventAccess(eventId);   (access.ts)
//
// Every call, in order: verifies sign-in, identifies the user from the server session, checks
// membership (non-members look exactly like unknown events, D-027), then checks the role against the
// permission matrix (D-035). The role comes from the database, never from the request. Hiding a
// button in the UI is never a substitute.
import "server-only";
import { AuthUnavailableError, getCurrentUser, requireUser, type AuthUser } from "@/lib/auth";
import { getEventAccess } from "./access";
import type { EventDetails } from "./list";
import { can, type Permission } from "./permissions";

export type EventAuthorization =
  | { ok: true; user: AuthUser; event: EventDetails }
  | {
      ok: false;
      /**
       * not-found: unknown event, malformed ID, or the user is not a member (indistinguishable).
       * forbidden: a member whose role lacks the permission.
       * no-database: dev-only demo sign-in without a database (D-024).
       */
      reason: "not-found" | "forbidden" | "no-database";
    };

async function authorizeUser(
  user: AuthUser,
  eventId: string,
  permission: Permission,
): Promise<EventAuthorization> {
  const access = await getEventAccess(user.id, eventId);
  if (access.kind !== "ok") return { ok: false, reason: access.kind };
  if (!can(access.event.role, permission)) return { ok: false, reason: "forbidden" };
  return { ok: true, user, event: access.event };
}

/**
 * For server actions. Signed out: redirects to sign in, returning to `returnPath` (default: the
 * event). Database errors are thrown, so the caller's own try/catch or error page handles them.
 */
export async function authorizeEvent(
  eventId: string,
  permission: Permission,
  returnPath = `/events/${encodeURIComponent(eventId)}`,
): Promise<EventAuthorization> {
  const user = await requireUser(returnPath);
  return authorizeUser(user, eventId, permission);
}

const NO_STORE = { "Cache-Control": "private, no-store" };

/** A JSON error response that is never cached. */
export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: NO_STORE });
}

/**
 * For API route handlers. Answers 401 signed out, 404 unknown or not a member, 403 a member without
 * the permission (D-036), 503 when sign-in or (demo) the database is unavailable, 500 on a database
 * error. Never reveals whether an event the caller is not a member of exists.
 */
export async function authorizeEventRequest(
  eventId: string,
  permission: Permission,
): Promise<
  | { ok: true; user: AuthUser; event: EventDetails; headers: HeadersInit }
  | { ok: false; response: Response }
> {
  let user: AuthUser | null;
  try {
    user = await getCurrentUser();
  } catch (cause) {
    if (cause instanceof AuthUnavailableError) {
      return {
        ok: false,
        response: jsonError(503, "Sign-in is unavailable. Try again in a moment."),
      };
    }
    throw cause;
  }
  if (!user) return { ok: false, response: jsonError(401, "Sign in to continue.") };

  let result: EventAuthorization;
  try {
    result = await authorizeUser(user, eventId, permission);
  } catch {
    return {
      ok: false,
      response: jsonError(500, "We couldn't load this event. Try again in a moment."),
    };
  }
  if (result.ok) return { ...result, headers: NO_STORE };
  const response = {
    "not-found": () => jsonError(404, "Event not found."),
    forbidden: () => jsonError(403, "Your role doesn't allow this."),
    "no-database": () => jsonError(503, "No database is configured."),
  }[result.reason]();
  return { ok: false, response };
}