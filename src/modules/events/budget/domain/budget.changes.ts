// src/modules/events/budget/domain/budget.changes.ts
// Works out which fields an edit really changes, so a save that changes nothing is reported as
// "nothing changed" and writes no audit entry (D-037). Pure: compares exact strings only; amounts
// are already normalized to two places by the form schema.

export type FieldChanges = Record<string, { from: string | null; to: string | null }>;

/** Lists the fields whose value differs between `current` and `next`. Empty when nothing changed. */
export function diffFields<T extends Record<string, string | null>>(
  fields: readonly (keyof T & string)[],
  current: T,
  next: T,
): FieldChanges {
  const changes: FieldChanges = {};
  for (const field of fields) {
    if (current[field] !== next[field]) {
      changes[field] = { from: current[field] ?? null, to: next[field] ?? null };
    }
  }
  return changes;
}

export const hasChanges = (changes: FieldChanges) => Object.keys(changes).length > 0;

/**
 * Keeps the field names that changed but drops their values, for fields that must never be copied
 * into the audit log (item notes, D-085: recorded as "changed").
 */
export function redactFields(changes: FieldChanges, fields: readonly string[]): FieldChanges {
  const result: FieldChanges = {};
  for (const [field, change] of Object.entries(changes)) {
    result[field] = fields.includes(field) ? { from: null, to: null } : change;
  }
  return result;
}