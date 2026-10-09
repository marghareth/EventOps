// src/lib/supabase/config.ts
// Supabase URL and public (anon) key, validated. Read with explicit property access so Next.js
// can inline the NEXT_PUBLIC_ values wherever this runs.
import { parsePublicEnv } from "@/lib/env";

export function supabaseConfig(): { url: string; anonKey: string } {
  const env = parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
}