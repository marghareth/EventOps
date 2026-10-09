// src/lib/supabase/server.ts
// Supabase client for Server Components, Server Actions and Route Handlers. Create one per
// request; never share it. The session lives in cookies managed by @supabase/ssr.
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";

export async function createSupabaseServerClient() {
  const { url, anonKey } = supabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. That is safe to ignore: the proxy refreshes
          // the session cookie on every request (src/proxy.ts). Server Actions and Route
          // Handlers can write cookies, so sign-in and sign-out persist there.
        }
      },
    },
  });
}