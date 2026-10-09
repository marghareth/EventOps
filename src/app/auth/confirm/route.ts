// src/app/auth/confirm/route.ts
// Landing point for email confirmation links. Supports both link styles Supabase can send:
// - ?token_hash=...&type=signup|email  (recommended email template, works on any device)
// - ?code=...                           (default template, PKCE: same browser that signed up)
// On success the user is signed in, their users row is created, and they go to `next`.
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { syncUserRecord } from "@/lib/auth";
import { confirmTypeSchema, safeNextPath } from "@/lib/auth-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const tokenHash = params.get("token_hash");
  const code = params.get("code");

  const supabase = await createSupabaseServerClient();
  let user = null;

  if (tokenHash) {
    const type = confirmTypeSchema.safeParse(params.get("type"));
    if (type.success) {
      const { data, error } = await supabase.auth.verifyOtp({
        type: type.data,
        token_hash: tokenHash,
      });
      if (!error) user = data.user;
    }
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) user = data.user;
  }

  if (!user) redirect("/login?error=confirm");

  let synced = true;
  try {
    await syncUserRecord(user);
  } catch {
    synced = false;
    await supabase.auth.signOut({ scope: "local" });
  }
  // redirect() works by throwing, so it stays outside the try block.
  redirect(synced ? next : "/login?error=unavailable");
}