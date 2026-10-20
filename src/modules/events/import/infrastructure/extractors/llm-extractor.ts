// src/modules/events/import/infrastructure/extractors/llm-extractor.ts
// The open-weight column suggester (B9-F12, F13; D-111, D-112): Qwen2.5 7B Instruct (Apache-2.0)
// served by Ollama, called from the server only. One request with a 20-second limit; any failure
// (unreachable, slow, an HTTP error, an answer that isn't JSON of the agreed shape, or too long)
// returns a reason instead of throwing, so the import falls back to the deterministic matcher.
// Nothing is retried, logged or stored: the request holds headers and a few sample values only.
import "server-only";
import type { ColumnSuggester, SuggesterResult } from "../../application/ports";
import { LLM_OUTPUT_JSON_SCHEMA, llmOutputSchema } from "./llm-output-schema";
import { SYSTEM_PROMPT, userPrompt } from "./prompt";

export const DEFAULT_MODEL = "qwen2.5:7b-instruct";
export const SUGGESTION_TIMEOUT_MS = 20_000;
/** Largest response read from the model server. */
const MAX_RESPONSE_CHARS = 200_000;

export function ollamaSuggester(config: {
  url: string;
  model?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}): ColumnSuggester {
  const model = config.model ?? DEFAULT_MODEL;
  const doFetch = config.fetch ?? fetch;
  const endpoint = new URL("api/chat", config.url.endsWith("/") ? config.url : `${config.url}/`);
  return {
    label: model === DEFAULT_MODEL ? "Qwen2.5 7B Instruct (Apache-2.0)" : model,
    async suggest(request): Promise<SuggesterResult> {
      let text: string;
      try {
        const response = await doFetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model,
            stream: false,
            format: LLM_OUTPUT_JSON_SCHEMA,
            options: { temperature: 0 },
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt(request) },
            ],
          }),
          signal: AbortSignal.timeout(config.timeoutMs ?? SUGGESTION_TIMEOUT_MS),
          redirect: "error",
          cache: "no-store",
        });
        if (!response.ok) return { ok: false, reason: "unavailable" };
        text = await response.text();
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        return {
          ok: false,
          reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "unavailable",
        };
      }
      if (text.length > MAX_RESPONSE_CHARS) return { ok: false, reason: "invalid" };
      try {
        const envelope = JSON.parse(text) as { message?: { content?: unknown } };
        const content = envelope?.message?.content;
        if (typeof content !== "string") return { ok: false, reason: "invalid" };
        const parsed = llmOutputSchema.safeParse(JSON.parse(content));
        return parsed.success
          ? { ok: true, output: parsed.data }
          : { ok: false, reason: "invalid" };
      } catch {
        return { ok: false, reason: "invalid" };
      }
    },
  };
}