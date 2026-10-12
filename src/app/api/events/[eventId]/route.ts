// src/app/api/events/[eventId]/route.ts
// GET /api/events/<id> (B1-04): one event and the caller's role, for members only. Unknown events,
// other users' events and malformed IDs all answer the same 404, so the API never reveals whether
// an event exists (D-027).
import { AuthUnavailableError, getCurrentUser } from "@/lib/auth";
import { getEventAccess } from "@/modules/events/public";

const headers = { "Cache-Control": "private, no-store" };

function error(status: number, message: string) {
  return Response.json({ error: message }, { status, headers });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<Response> {
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

  const { eventId } = await params;
  try {
    const access = await getEventAccess(user.id, eventId);
    if (access.kind === "not-found") return error(404, "Event not found.");
    if (access.kind === "no-database") return error(503, "No database is configured.");
    return Response.json({ event: access.event }, { headers });
  } catch {
    return error(500, "We couldn't load this event. Try again in a moment.");
  }
}