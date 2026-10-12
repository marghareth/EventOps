// src/app/(app)/events/[eventId]/event-title.ts
// The event's name for browser tab titles (B1-13, D-038), read through the same membership check as
// the pages (request-cached, so no extra queries). Null when signed out, refused, unknown or on any
// error: the title then simply leaves the name out.
import { getCurrentUser } from "@/lib/auth";
import { getEventAccess } from "@/modules/events/public";

export async function eventNameForTitle(eventId: string): Promise<string | null> {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const access = await getEventAccess(user.id, eventId);
    return access.kind === "ok" ? access.event.name : null;
  } catch {
    return null;
  }
}