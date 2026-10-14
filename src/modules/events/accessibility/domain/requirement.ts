// src/modules/events/accessibility/domain/requirement.ts
// An attendee's accessibility requirement as the domain sees it (B3-02, D-057), and what changed
// between two versions of it (for the audit log, D-059). Pure: no database, no clock.
import type { RequirementPriority, RequirementType } from "./requirement-type";

/** A requirement's editable values, as validated (schema.ts). */
export type RequirementInput = {
  type: RequirementType;
  priority: RequirementPriority;
  /** Free text, up to 500 characters; always set for OTHER. May hold health details (D-058). */
  note: string | null;
};

/** What changed, for "accessibility_requirement.updated". The note is never copied, only flagged. */
export type RequirementChanges = {
  type?: { from: RequirementType; to: RequirementType };
  priority?: { from: RequirementPriority; to: RequirementPriority };
  note?: { changed: true };
};

export function requirementChanges(
  before: RequirementInput,
  after: RequirementInput,
): RequirementChanges {
  const changes: RequirementChanges = {};
  if (before.type !== after.type) changes.type = { from: before.type, to: after.type };
  if (before.priority !== after.priority) {
    changes.priority = { from: before.priority, to: after.priority };
  }
  if (before.note !== after.note) changes.note = { changed: true };
  return changes;
}