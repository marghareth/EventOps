// src/modules/events/accessibility/application/update-requirement.ts
// Edit an attendee's accessibility requirement (B3-03). Works out what changed with the domain's
// rules (D-059): nothing changed means nothing is written or recorded. Otherwise the repository saves
// only if nobody saved since `version` (D-032), re-checks the role, and records the changes.
import { requirementChanges, type RequirementInput } from "../domain/requirement";
import type { AccessibilityRepository, UpdateRequirementResult } from "./ports";

export type UpdateRequirementOutcome = UpdateRequirementResult | { ok: true; unchanged: true };

export async function updateRequirement(
  repository: AccessibilityRepository,
  args: {
    eventId: string;
    attendeeId: string;
    requirementId: string;
    actorId: string;
    version: Date;
    input: RequirementInput;
  },
): Promise<UpdateRequirementOutcome> {
  const before = await repository.findRequirement(
    args.eventId,
    args.attendeeId,
    args.requirementId,
  );
  if (!before) return { ok: false, reason: "not-found" };
  const changes = requirementChanges(before, args.input);
  if (Object.keys(changes).length === 0) return { ok: true, unchanged: true };
  return repository.updateRequirement({ ...args, changes });
}