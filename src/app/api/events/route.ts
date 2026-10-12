// src/app/api/events/route.ts
// GET /api/events (B1-03): the signed-in user's events, as JSON. Only events the user is a member
// of are returned (see listEventsForUser); the user comes from the session, never the request.
import { AuthUnavailableError, getCurrentUser } from "@/lib/auth";
import { getMyEvents } from "@/modules/events/public";

const headers = { "Cache-Control": "private, no-store" };

function error(status: number, message: string) {
  return Response.json({ error: message }, { status, headers });
}

export async function GET(): Promise<Response> {
  let user;
  try {
    user = await getCurrentUser();
  } catch (cause) {
    if (cause instanceof AuthUnavailableError) {
      return error(503, "Sign-in is unavailable. Try again in a moment.");
    }
    throw cause;
  }
  if (!user) return error(401, "Sign in to continue.");

  try {
    return Response.json({ events: await getMyEvents(user.id) }, { headers });
  } catch {
    return error(500, "We couldn't load your events. Try again in a moment.");
  }
}