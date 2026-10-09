// src/lib/env.ts
import { z } from "zod";

// Server and public variables are validated together. No secret may use a NEXT_PUBLIC_ prefix.
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  AI_IMPORT_ENABLED: z.enum(["true", "false"]).default("false"),
});

export function parseEnv(source: Record<string, string | undefined>) {
  return schema.parse(source);
}