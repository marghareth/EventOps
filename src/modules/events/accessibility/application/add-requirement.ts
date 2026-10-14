// src/modules/events/accessibility/application/add-requirement.ts
// Add an accessibility requirement to an attendee (B3-03, D-056). The caller has authenticated the
// actor and authorized with authorizeEvent(eventId, "accessibility.manage") (D-036); the repository
// re-checks the role, finds the attendee only inside the event, refuses a second requirement of the
// same type and records "accessibility_requirement.created" in the same transaction.
import type { RequirementInput } from "../domain/requirement";
import type { AccessibilityRepository, CreateRequirementResult } from "./ports";

export function addRequirement(
  repository: AccessibilityRepository,
  args: { eventId: string; attendeeId: string; actorId: string; input: RequirementInput },
): Promise<CreateRequirementResult> {
  return repository.createRequirement(args);
}