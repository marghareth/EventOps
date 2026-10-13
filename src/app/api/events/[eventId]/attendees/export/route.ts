// src/app/api/events/[eventId]/attendees/export/route.ts
// GET /api/events/<id>/attendees/export (B2-19, D-053): the event's guest list as a CSV download,
// for roles with attendees.export (Owner, Coordinator). Authorized through authorizeEventRequest
// (D-036): 401 signed out, 404 for unknown events and non-members (never revealing which), 403 for
// Viewers. Only the authorized event's attendees are read, and each export is recorded in
// Activity. Replaces the B0-10 placeholder at /api/attendees/export.
import {
  attendeesCsv,
  exportEventAttendees,
  exportFileName,
} from "@/modules/events/attendees/public";
import { authorizeEventRequest, jsonError } from "@/modules/events/public";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  const { eventId } = await params;
  const auth = await authorizeEventRequest(eventId, "attendees.export");
  if (!auth.ok) return auth.response;

  const now = new Date();
  let attendees;
  try {
    attendees = await exportEventAttendees({ eventId: auth.event.id, userId: auth.user.id, now });
  } catch {
    return jsonError(500, "We couldn't export the guest list. Try again in a moment.");
  }
  if (!attendees) return jsonError(403, "Your role doesn't allow this.");

  const headers = new Headers(auth.headers);
  headers.set("Content-Type", "text/csv; charset=utf-8");
  headers.set(
    "Content-Disposition",
    `attachment; filename="${exportFileName(auth.event.reference, now)}"`,
  );
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(attendeesCsv(attendees), { status: 200, headers });
}