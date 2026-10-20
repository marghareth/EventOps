// src/modules/events/import/composition.ts
// Wires the import's use cases to their adapters (D-001, D-112). The model is asked only when
// AI_IMPORT_ENABLED is "true" and OLLAMA_URL is set; otherwise there is no suggester and the
// deterministic matcher is used. On Vercel, OLLAMA_URL is left unset (a serverless function can't
// run the model), so the deployed app always uses the matcher.
import "server-only";
import { parseAiImportEnv } from "@/lib/env.server";
import type { ColumnSuggester } from "./application/ports";
import { ollamaSuggester } from "./infrastructure/extractors/llm-extractor";

export function columnSuggester(
  source: Record<string, string | undefined> = process.env,
): ColumnSuggester | null {
  let env: ReturnType<typeof parseAiImportEnv>;
  try {
    env = parseAiImportEnv(source);
  } catch {
    return null; // Misconfigured settings never break the import: the matcher still works.
  }
  if (env.AI_IMPORT_ENABLED !== "true" || !env.OLLAMA_URL) return null;
  return ollamaSuggester({ url: env.OLLAMA_URL, model: env.OLLAMA_MODEL });
}