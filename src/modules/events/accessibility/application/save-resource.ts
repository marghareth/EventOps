// src/modules/events/accessibility/application/save-resource.ts
// Set up or edit one of the event's accessibility resources (B3-05, D-061). The caller has
// authorized with accessibility.manage (D-036); the repository re-checks the role in storage.
//   - No version: the form was opened while the type was "Not set up", so this creates it. If
//     someone set it up meanwhile, nothing is overwritten ("exists").
//   - A version: an edit that saves only if nobody saved since (D-032). Nothing changed means
//     nothing is written or recorded.
import { resourceChanges, type ResourceInput, type ResourceType } from "../domain/resource";
import type { AccessibilityRepository, CreateResourceResult, UpdateResourceResult } from "./ports";

export type SaveResourceOutcome =
  CreateResourceResult | UpdateResourceResult | { ok: true; unchanged: true };

export async function saveResource(
  repository: AccessibilityRepository,
  args: {
    eventId: string;
    type: ResourceType;
    actorId: string;
    /** The stored version the form was opened with, or null when it was "Not set up". */
    version: Date | null;
    input: ResourceInput;
  },
): Promise<SaveResourceOutcome> {
  const { version, ...rest } = args;
  if (version === null) return repository.createResource(rest);
  const before = await repository.findResource(args.eventId, args.type);
  if (!before) return { ok: false, reason: "not-found" };
  const changes = resourceChanges(before, args.input);
  if (Object.keys(changes).length === 0) return { ok: true, unchanged: true };
  return repository.updateResource({ ...rest, version, changes });
}