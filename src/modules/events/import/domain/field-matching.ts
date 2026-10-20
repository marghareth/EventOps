// src/modules/events/import/domain/field-matching.ts
// Automatic header matching and keyword-based field detection (B9-F06, F08; D-110). The
// deterministic matcher behind the AI suggestion, and its fallback (D-112):
//   1. a header equal to a field's word ("Guest Name" → guestname) suggests that field,
//   2. then a header containing one of the words ("Mobile no." → mobile) does,
//   3. then a column of email addresses or phone numbers with no field yet gets Email or Phone,
// skipping a field whose accepted types don't fit the column's type ("Contact" holding emails is
// not a phone number). Each field goes to one column at most, earlier columns first. The word
// lists belong to the attendees and suppliers contexts; this file only applies them. Pure.
import type { ColumnType } from "./column-types";

export type FieldRule = {
  field: string;
  /** Header words, lower case, letters and digits only. */
  words: readonly string[];
  /** The column types the field fits. Text and empty columns fit every field. */
  accepts?: readonly ColumnType[];
  /** A column of this type with no field yet goes to this field. */
  byType?: "email" | "phone";
};

export type ColumnFacts = { header: string; type: ColumnType };

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** The header as one key ("guestname") and as its words and word pairs. */
function headerKeys(header: string): { key: string; parts: Set<string> } {
  const tokens = fold(header)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const parts = new Set(tokens);
  for (let i = 0; i + 1 < tokens.length; i += 1) parts.add(tokens[i] + tokens[i + 1]);
  return { key: tokens.join(""), parts };
}

const fits = (rule: FieldRule, type: ColumnType) =>
  type === "text" || type === "empty" || !rule.accepts || rule.accepts.includes(type);

/** How well a header names a field: 2 equal, 1 contains a word, 0 not at all. */
function headerScore(rule: FieldRule, header: string): 0 | 1 | 2 {
  const { key, parts } = headerKeys(header);
  if (rule.words.includes(key)) return 2;
  return rule.words.some((w) => parts.has(w)) ? 1 : 0;
}

/** The suggested field for each column, or null for "Don't import". */
export function matchColumns(
  columns: readonly ColumnFacts[],
  rules: readonly FieldRule[],
): (string | null)[] {
  const result: (string | null)[] = columns.map(() => null);
  const used = new Set<string>();
  const assign = (pick: (column: ColumnFacts) => FieldRule | undefined) => {
    columns.forEach((column, i) => {
      if (result[i] !== null) return;
      const rule = pick(column);
      if (!rule) return;
      result[i] = rule.field;
      used.add(rule.field);
    });
  };
  for (const score of [2, 1] as const) {
    assign((column) =>
      rules.find(
        (rule) =>
          !used.has(rule.field) &&
          fits(rule, column.type) &&
          headerScore(rule, column.header) === score,
      ),
    );
  }
  assign((column) =>
    rules.find((rule) => !used.has(rule.field) && rule.byType && rule.byType === column.type),
  );
  return result;
}

/**
 * Which import type the headers look like (D-109): the type with more columns named by words that
 * only that type uses (Name and Email belong to both). Null when they're even.
 */
export function suggestImportType<K extends string>(
  columns: readonly ColumnFacts[],
  rulesByType: Record<K, readonly FieldRule[]>,
): K | null {
  const kinds = Object.keys(rulesByType) as K[];
  const wordsOf = (kind: K) => new Set(rulesByType[kind].flatMap((r) => r.words));
  const scores = kinds.map((kind) => {
    const others = kinds.filter((k) => k !== kind).map(wordsOf);
    const own = rulesByType[kind]
      .map((rule) => ({
        ...rule,
        words: rule.words.filter((w) => !others.some((set) => set.has(w))),
      }))
      .filter((rule) => rule.words.length > 0);
    return columns.filter((column) => own.some((rule) => headerScore(rule, column.header) > 0))
      .length;
  });
  const best = Math.max(...scores);
  if (best === 0 || scores.filter((s) => s === best).length > 1) return null;
  return kinds[scores.indexOf(best)];
}