// src/lib/api-placeholder.ts
// Shared response for API routes whose feature task has not run yet (B0-10, D-019).
// Signed out: 401. Signed in: 501 Not Implemented. Never returns data.
import "server-only";
import { getCurrentUser } from "./auth";

export async function placeholderRouteResponse(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  return Response.json({ error: "Not implemented yet." }, { status: 501 });
}