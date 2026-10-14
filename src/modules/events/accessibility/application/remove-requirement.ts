// src/modules/events/accessibility/application/remove-requirement.ts
// Remove an attendee's accessibility requirement (B3-03). Permanent; the audit entry keeps the
// attendee's readable ID and the type, never the note (D-059). The repository re-checks the role
// and finds the requirement only for this attendee in this event.
import type { AccessibilityRepository, DeleteRequirementResult } from "./ports";

export function removeRequirement(
  repository: AccessibilityRepository,
  args: { eventId: string; attendeeId: string; requirementId: string; actorId: string },
): Promise<DeleteRequirementResult> {
  return repository.deleteRequirement(args);
}