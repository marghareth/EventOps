// src/proxy.ts
// Runs before every matched request (Next.js 16 "proxy", formerly "middleware").
// 1. Refreshes the Supabase session cookie.
// 2. Sends signed-out visitors of protected pages to /login?next=..., and signed-in visitors of
//    /login or /sign-up to the app.
// This is a convenience, not the security boundary: proxies can be bypassed, so every protected
// page, server action and route handler checks the user itself (src/lib/auth.ts).
import { NextResponse, type NextRequest } from "next/server";
import { decideProxyAction } from "@/lib/auth-rules";
import { isDemoAuthEnabled } from "@/lib/demo-auth";
import { redirectWithSession, updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Dev-only demo sign-in (D-024): no Supabase session to refresh, and every page is reachable,
  // including /login and /sign-up so they can be viewed too.
  if (isDemoAuthEnabled()) return NextResponse.next();

  const session = await updateSession(request);
  const decision = decideProxyAction(
    request.nextUrl.pathname,
    request.nextUrl.search,
    session.hasSession,
  );
  return decision.kind === "redirect"
    ? redirectWithSession(request, session, decision.to)
    : session.response;
}

export const config = {
  matcher: [
    // Everything except Next.js internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};