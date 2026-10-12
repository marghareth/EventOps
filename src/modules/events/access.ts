// src/modules/events/access.ts
// Event access check (B1-04, D-027). Every page, server action and route handler under an event
// calls this itself: a check in the layout does not protect a page, because Next.js renders layouts
// and pages in parallel. Membership only for now; role permissions wait for the permission matrix
// (DECISIONS.md open item 7).
import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { requireUser, type AuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isDemoWithoutDatabase } from "@/lib/demo-auth";
import type { EventDetails } from "./list";
import { getEventForMember } from "./queries";

export type EventAccess =
  | { kind: "ok"; event: EventDetails }
  /** Unknown event, another user's event, or a malformed ID. Always shown as "not found". */
  | { kind: "not-found" }
  /** Demo sign-in with no database (D-024): there is no event data to load. */
  | { kind: "no-database" };

const eventIdSchema = z.uuid();

/**
 * The event if `userId` is a member of it. Cached per request, so the layout, the page and later
 * module code share one query. Database errors are thrown to the caller.
 */
export const getEventAccess = cache(
  async (userId: string, eventId: string): Promise<EventAccess> => {
    if (!eventIdSchema.safeParse(eventId).success) return { kind: "not-found" };
    if (isDemoWithoutDatabase()) return { kind: "no-database" };
    const event = await getEventForMember(getDb(), eventId, userId);
    return event ? { kind: "ok", event } : { kind: "not-found" };
  },
);

/**
 * For pages and server actions: the signed-in user and their event. Signed out: redirects to sign
 * in. Not a member, unknown or malformed ID: the not-found page (D-027).
 */
export async function requireEventAccess(
  eventId: string,
): Promise<{ user: AuthUser; access: Exclude<EventAccess, { kind: "not-found" }> }> {
  const user = await requireUser(`/events/${encodeURIComponent(eventId)}`);
  const access = await getEventAccess(user.id, eventId);
  if (access.kind === "not-found") notFound();
  return { user, access };
}