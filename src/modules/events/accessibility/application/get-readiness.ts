// src/modules/events/accessibility/application/get-readiness.ts
// The event's accessibility readiness (B3-10): loads the requirements and resources from storage and
// runs the pure domain rules, coverage (D-062), status (D-063) and gaps (D-064). Nothing is stored.
// The caller authorizes first; this use case decides no permission.
import { detectGaps, type Gap } from "../domain/gaps";
import { assessCoverage, type Coverage } from "../domain/readiness";
import {
  decidingCounts,
  readinessStatus,
  type DecidingCounts,
  type ReadinessStatus,
} from "../domain/readiness-status";
import type { AccessibilityRepository, ResourceRecord } from "./ports";

export type Readiness = {
  status: ReadinessStatus;
  counts: DecidingCounts;
  coverage: Coverage;
  gaps: Gap[];
  /** The recorded resources the calculation used. */
  resources: ResourceRecord[];
};

export async function getReadiness(
  repository: AccessibilityRepository,
  eventId: string,
): Promise<Readiness> {
  const [requirements, resources] = await Promise.all([
    repository.listEventRequirements(eventId),
    repository.listResources(eventId),
  ]);
  const coverage = assessCoverage({ requirements, resources });
  return {
    status: readinessStatus(coverage),
    counts: decidingCounts(coverage),
    coverage,
    gaps: detectGaps(coverage),
    resources,
  };
}