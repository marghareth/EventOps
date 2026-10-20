// src/lib/env.server.ts
// Server-only variables. The server-only import fails the build if a client component pulls this in.
import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  AI_IMPORT_ENABLED: z.enum(["true", "false"]).default("false"),
  // The Ollama server for AI import (D-112), for example http://localhost:11434. Blank means none:
  // the import then uses the deterministic matcher only.
  OLLAMA_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url({ protocol: /^https?$/ }).optional(),
  ),
  OLLAMA_MODEL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(/^[\w.:/-]{1,100}$/)
      .optional(),
  ),
  // Dev-only demo sign-in (D-024). Honoured only under `next dev`; see src/lib/demo-auth.ts.
  DEV_DEMO_AUTH: z.enum(["true", "false"]).default("false"),
});

export function parseServerEnv(source: Record<string, string | undefined>) {
  return serverSchema.parse(source);
}
/** Only the AI import settings (D-112), so the import can read them without the database ones. */
export function parseAiImportEnv(source: Record<string, string | undefined>) {
  return serverSchema
    .pick({ AI_IMPORT_ENABLED: true, OLLAMA_URL: true, OLLAMA_MODEL: true })
    .parse(source);
}