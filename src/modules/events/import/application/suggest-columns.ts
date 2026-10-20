// src/modules/events/import/application/suggest-columns.ts
// The column suggestion (B9-F05, F12 to F15; D-111, D-112). The deterministic matcher always runs.
// When the open-weight model is on, it is asked too, and its answer is used only if it passes:
//   1. JSON and schema checks (in the suggester),
//   2. business checks here: every column index once and in range, only fields of the chosen
//      import type, each field once, and the required fields mapped (the import type's own rules),
// otherwise the matcher's suggestion is used and the page says so. Either way the user reviews and
// confirms the matching, and every row then goes through the same deterministic validation. The
// model never decides what is saved.
import { columnType, type ColumnType } from "../domain/column-types";
import { matchColumns, suggestImportType, type FieldRule } from "../domain/field-matching";
import type { ImportType } from "../domain/file-policy";
import type { ColumnSuggester, SuggestionOutput } from "./ports";

/** What the model sees of each column: at most 3 values, 40 characters each (D-111). */
export const SAMPLE_LIMITS = { values: 3, characters: 40, header: 60 } as const;

export type ImportTargetRules = {
  fields: readonly { id: string; label: string }[];
  rules: readonly FieldRule[];
  /** The import type's own mapping check (required fields, each once, only its fields). */
  isValidMapping: (mapping: (string | null)[]) => boolean;
};

export type ColumnSuggestion = {
  mapping: (string | null)[];
  columnTypes: ColumnType[];
  /** Which import type the columns look like, if one is clearer than the other. */
  looksLike: ImportType | null;
} & (
  | { source: "ai"; model: string }
  | { source: "rules"; fallback: "off" | "unavailable" | "rejected" }
);

type Table = { headers: readonly string[]; rows: readonly { cells: readonly string[] }[] };

/** Business checks of the model's answer (D-111). Null when it doesn't pass. */
export function mappingFromOutput(
  output: SuggestionOutput,
  columnCount: number,
  target: ImportTargetRules,
): (string | null)[] | null {
  const mapping: (string | null)[] = Array.from({ length: columnCount }, () => null);
  const seen = new Set<number>();
  const fields = new Set(target.fields.map((f) => f.id));
  for (const { index, field } of output.columns) {
    if (index >= columnCount || seen.has(index)) return null;
    seen.add(index);
    if (field === null) continue;
    if (!fields.has(field)) return null;
    mapping[index] = field;
  }
  return target.isValidMapping(mapping) ? mapping : null;
}

/** Each column's detected type (B9-F07), from all its values. */
export function detectColumnTypes(table: Table): ColumnType[] {
  return table.headers.map((_, i) => columnType(table.rows.map((r) => r.cells[i] ?? "")));
}

export async function suggestColumns(args: {
  table: Table;
  importType: ImportType;
  targets: Record<ImportType, ImportTargetRules>;
  suggester: ColumnSuggester | null;
}): Promise<ColumnSuggestion> {
  const { table, importType, targets } = args;
  const columnTypes = detectColumnTypes(table);
  const facts = table.headers.map((header, i) => ({ header, type: columnTypes[i] }));
  const rulesByType = {
    attendees: targets.attendees.rules,
    suppliers: targets.suppliers.rules,
  };
  const looks = suggestImportType(facts, rulesByType);
  const byRules = {
    mapping: matchColumns(facts, targets[importType].rules),
    columnTypes,
    looksLike: looks === importType ? null : looks,
  };
  if (!args.suggester) return { ...byRules, source: "rules", fallback: "off" };

  const result = await args.suggester.suggest({
    importType,
    fieldsByType: { attendees: targets.attendees.fields, suppliers: targets.suppliers.fields },
    columns: table.headers.map((header, index) => ({
      index,
      header: header.slice(0, SAMPLE_LIMITS.header),
      type: columnTypes[index],
      samples: table.rows
        .map((r) => (r.cells[index] ?? "").trim())
        .filter(Boolean)
        .slice(0, SAMPLE_LIMITS.values)
        .map((v) => v.slice(0, SAMPLE_LIMITS.characters)),
    })),
  });
  if (!result.ok) return { ...byRules, source: "rules", fallback: "unavailable" };
  const mapping = mappingFromOutput(result.output, table.headers.length, targets[importType]);
  if (!mapping) return { ...byRules, source: "rules", fallback: "rejected" };
  return {
    mapping,
    columnTypes,
    looksLike: result.output.looksLike === importType ? null : result.output.looksLike,
    source: "ai",
    model: args.suggester.label,
  };
}