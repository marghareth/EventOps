// src/modules/events/import/application/ports.ts
// What the import's use cases need from outside (D-001, D-111): a column suggester, which in
// production is the open-weight model behind Ollama. The application never knows how it is reached.
import type { ColumnType } from "../domain/column-types";
import type { ImportType } from "../domain/file-policy";

/** What the model is shown (D-111): headers, detected types and up to 3 short sample values. */
export type SuggestionRequest = {
  importType: ImportType;
  /** The fields of every import type, so the model can also say which type the file looks like. */
  fieldsByType: Record<ImportType, readonly { id: string; label: string }[]>;
  columns: readonly {
    index: number;
    header: string;
    type: ColumnType;
    samples: readonly string[];
  }[];
};

/** The model's answer after JSON and schema checks (D-111), not yet business-checked. */
export type SuggestionOutput = {
  looksLike: ImportType;
  columns: readonly { index: number; field: string | null }[];
};

export type SuggesterResult =
  | { ok: true; output: SuggestionOutput }
  /** Unreachable, too slow, or an answer that isn't valid JSON of the agreed shape. */
  | { ok: false; reason: "unavailable" | "timeout" | "invalid" };

export interface ColumnSuggester {
  /** The model's name and license, shown to the user next to its suggestion. */
  readonly label: string;
  suggest(request: SuggestionRequest): Promise<SuggesterResult>;
}