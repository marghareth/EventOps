// src/lib/supabase/middleware.ts
// Session refresh for the proxy (src/proxy.ts). Reads the auth cookies from the request, lets
// Supabase refresh an expiring session, and writes the new cookies onto the response.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./config";

export type SessionResult = {
  /** Response that carries any refreshed auth cookies. Copy its cookies onto a redirect. */
  response: NextResponse;
  /** True when the request has a valid, verified session. */
  hasSession: boolean;
};

export async function updateSession(request: NextRequest): Promise<SessionResult> {
  const { url, anonKey } = supabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set auth cookies must not be cached, or one user's session could be
        // served to another. @supabase/ssr supplies the no-store headers.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Must run straight after creating the client: it refreshes the session if needed.
  // getClaims verifies the token signature (D-013). This only drives the convenience redirect;
  // pages, actions and routes verify again with getUser() in src/lib/auth.ts.
  const { data, error } = await supabase.auth.getClaims();
  const hasSession = !error && Boolean(data?.claims?.sub);

  return { response, hasSession };
}

/** Builds a redirect that keeps the refreshed auth cookies and no-store headers. */
export function redirectWithSession(
  request: NextRequest,
  session: SessionResult,
  to: string,
): NextResponse {
  const redirect = NextResponse.redirect(new URL(to, request.url));
  for (const cookie of session.response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const key of ["cache-control", "expires", "pragma"]) {
    const value = session.response.headers.get(key);
    if (value) redirect.headers.set(key, value);
  }
  return redirect;
}