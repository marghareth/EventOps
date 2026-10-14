// src/modules/events/accessibility/application/remove-resource.ts
// Remove one of the event's accessibility resources (B3-05, D-061). Permanent: the type shows as
// "Not set up" again, and the audit entry keeps the type. The repository re-checks the role.
import type { ResourceType } from "../domain/resource";
import type { AccessibilityRepository, DeleteResourceResult } from "./ports";

export function removeResource(
  repository: AccessibilityRepository,
  args: { eventId: string; type: ResourceType; actorId: string },
): Promise<DeleteResourceResult> {
  return repository.deleteResource(args);
}