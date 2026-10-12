// src/app/api/events/[eventId]/route.ts
// GET /api/events/<id> (B1-04): one event and the caller's role, for members only. Authorized
// through authorizeEventRequest (B1-09, D-036): unknown events, other users' events and malformed
// IDs all answer the same 404, so the API never reveals whether an event exists (D-027).
import { authorizeEventRequest } from "@/modules/events/public";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  const { eventId } = await params;
  const auth = await authorizeEventRequest(eventId, "event.view");
  if (!auth.ok) return auth.response;
  return Response.json({ event: auth.event }, { headers: auth.headers });
}