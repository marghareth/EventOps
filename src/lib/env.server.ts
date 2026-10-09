// src/lib/env.server.ts
// Server-only variables. The server-only import fails the build if a client component pulls this in.
import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  AI_IMPORT_ENABLED: z.enum(["true", "false"]).default("false"),
});

export function parseServerEnv(source: Record<string, string | undefined>) {
  return serverSchema.parse(source);
}