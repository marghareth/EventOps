// src/lib/env.ts
// Public variables only. Safe to use in client code. Secrets live in env.server.ts.
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export function parsePublicEnv(source: Record<string, string | undefined>) {
  return publicSchema.parse(source);
}