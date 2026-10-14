// src/modules/events/accessibility/infrastructure/sample-accessibility-repository.ts
// The accessibility repository on the dev-only in-memory sample store (D-041). The store applies
// the same rules as PostgreSQL: one event at a time, accessibility.manage re-checked, one
// requirement per type, stale saves refused, audit entries. Never used in a build.
import "server-only";
import {
  sampleCreateRequirement,
  sampleCreateResource,
  sampleDeleteRequirement,
  sampleDeleteResource,
  sampleGetAttendee,
  sampleListEventRequirements,
  sampleListRequirements,
  sampleListResources,
  sampleUpdateRequirement,
  sampleUpdateResource,
} from "@/modules/events/public";
import type { AccessibilityRepository, RequirementRecord } from "../application/ports";
import { REQUIREMENT_TYPES } from "../domain/requirement-type";
import { RESOURCE_TYPES } from "../domain/resource";

const byDefinitionOrder = (a: RequirementRecord, b: RequirementRecord) =>
  REQUIREMENT_TYPES.indexOf(a.type) - REQUIREMENT_TYPES.indexOf(b.type);

export function sampleAccessibilityRepository(): AccessibilityRepository {
  return {
    async findAttendee(eventId, attendeeId) {
      const attendee = sampleGetAttendee(eventId, attendeeId);
      return attendee ? { id: attendee.id, number: attendee.number, name: attendee.name } : null;
    },
    async listRequirements(eventId, attendeeId, { withNotes }) {
      return sampleListRequirements(eventId, attendeeId)
        .map(({ note, ...row }): RequirementRecord => (withNotes ? { ...row, note } : row))
        .sort(byDefinitionOrder);
    },
    async findRequirement(eventId, attendeeId, requirementId) {
      return (
        sampleListRequirements(eventId, attendeeId).find((r) => r.id === requirementId) ?? null
      );
    },
    async createRequirement(args) {
      return sampleCreateRequirement({ ...args, now: new Date() });
    },
    async updateRequirement(args) {
      return sampleUpdateRequirement({ ...args, now: new Date() });
    },
    async deleteRequirement(args) {
      return sampleDeleteRequirement({ ...args, now: new Date() });
    },
    async listEventRequirements(eventId) {
      return sampleListEventRequirements(eventId);
    },
    async listResources(eventId) {
      return sampleListResources(eventId).sort(
        (a, b) => RESOURCE_TYPES.indexOf(a.type) - RESOURCE_TYPES.indexOf(b.type),
      );
    },
    async findResource(eventId, type) {
      return sampleListResources(eventId).find((r) => r.type === type) ?? null;
    },
    async createResource(args) {
      return sampleCreateResource({ ...args, now: new Date() });
    },
    async updateResource(args) {
      return sampleUpdateResource({ ...args, now: new Date() });
    },
    async deleteResource(args) {
      return sampleDeleteResource({ ...args, now: new Date() });
    },
  };
}