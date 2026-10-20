// src/modules/events/import/infrastructure/extractors/llm-output-schema.ts
// The only answer shape accepted from the model (B9-F14, D-111). Strict: unknown keys, a wrong
// type, an unknown import type or more columns than a file may have are refused, and the whole
// answer is then ignored. Business checks follow in the application (suggest-columns.ts).
import { z } from "zod";
import { IMPORT_TYPES } from "../../domain/file-policy";

const MAX_COLUMNS = 50;

export const llmOutputSchema = z
  .object({
    looksLike: z.enum(IMPORT_TYPES),
    columns: z
      .array(
        z
          .object({
            index: z
              .number()
              .int()
              .min(0)
              .max(MAX_COLUMNS - 1),
            field: z.string().min(1).max(40).nullable(),
          })
          .strict(),
      )
      .max(MAX_COLUMNS),
  })
  .strict();

/** The same shape as a JSON schema, sent as Ollama's `format` so the model answers in it. */
export const LLM_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["looksLike", "columns"],
  properties: {
    looksLike: { type: "string", enum: [...IMPORT_TYPES] },
    columns: {
      type: "array",
      maxItems: MAX_COLUMNS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "field"],
        properties: {
          index: { type: "integer", minimum: 0, maximum: MAX_COLUMNS - 1 },
          field: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;