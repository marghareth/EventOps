// src/modules/events/accessibility/application/ports.ts
// What the accessibility use cases need from storage (D-001). Implemented with Prisma
// (infrastructure/prisma-accessibility-repository.ts) and, for dev-only sample data (D-041), with
// the in-memory store (infrastructure/sample-accessibility-repository.ts). Every method works inside
// one event only; writes re-check the actor's role in storage (rolesAllowed) and record the audit
// entry in the same transaction (D-036, D-037).
import type { RequirementChanges, RequirementInput } from "../domain/requirement";
import type { ReadinessRequirement } from "../domain/readiness";
import type { ResourceChanges, ResourceInput, ResourceType } from "../domain/resource";

/** The attendee a requirement belongs to, as accessibility pages show it. */
export type AttendeeIdentity = { id: string; number: number; name: string };

/** A stored requirement as listed. `note` is absent when the reader's role may not see it (D-058). */
export type RequirementRecord = Omit<RequirementInput, "note"> & {
  id: string;
  attendeeId: string;
  /** The edit version (D-032). */
  updatedAt: Date;
  note?: string | null;
};

/** A stored requirement with its note, for editing (callers authorize with accessibility.manage). */
export type FullRequirementRecord = RequirementRecord & { note: string | null };

export type CreateRequirementResult =
  | { ok: true; id: string }
  /** No such attendee in this event, or the actor may not manage accessibility: nothing saved. */
  | { ok: false; reason: "not-found" }
  /** The attendee already has a requirement of this type (one per type, D-056). */
  | { ok: false; reason: "duplicate" };

export type UpdateRequirementResult =
  { ok: true } | { ok: false; reason: "not-found" | "stale" | "duplicate" };

export type DeleteRequirementResult =
  { ok: true; type: RequirementInput["type"] } | { ok: false; reason: "not-found" };

/** A stored event resource (B3-05). At most one per type per event (D-056). */
export type ResourceRecord = ResourceInput & {
  id: string;
  type: ResourceType;
  /** The edit version (D-032). */
  updatedAt: Date;
};

export type CreateResourceResult =
  | { ok: true }
  /** No such event, or the actor may not manage accessibility: nothing saved. */
  | { ok: false; reason: "not-found" }
  /** Someone set this type up meanwhile (one per type, D-056). */
  | { ok: false; reason: "exists" };

export type UpdateResourceResult = { ok: true } | { ok: false; reason: "not-found" | "stale" };

export type DeleteResourceResult = { ok: true } | { ok: false; reason: "not-found" };

export interface AccessibilityRepository {
  /** The attendee, only if it belongs to this event. */
  findAttendee(eventId: string, attendeeId: string): Promise<AttendeeIdentity | null>;
  /** The attendee's requirements in definition order; notes only when `withNotes`. */
  listRequirements(
    eventId: string,
    attendeeId: string,
    options: { withNotes: boolean },
  ): Promise<RequirementRecord[]>;
  /** One requirement of this attendee in this event, with its note (callers authorize first). */
  findRequirement(
    eventId: string,
    attendeeId: string,
    requirementId: string,
  ): Promise<FullRequirementRecord | null>;
  createRequirement(args: {
    eventId: string;
    attendeeId: string;
    actorId: string;
    input: RequirementInput;
  }): Promise<CreateRequirementResult>;
  /** Saves only if `version` is still current (D-032); `changes` is recorded in the audit log. */
  updateRequirement(args: {
    eventId: string;
    attendeeId: string;
    requirementId: string;
    actorId: string;
    version: Date;
    input: RequirementInput;
    changes: RequirementChanges;
  }): Promise<UpdateRequirementResult>;
  deleteRequirement(args: {
    eventId: string;
    attendeeId: string;
    requirementId: string;
    actorId: string;
  }): Promise<DeleteRequirementResult>;

  /**
   * Every requirement in the event with its guest's number, name and RSVP, for readiness (B3-10).
   * Never the note (D-058).
   */
  listEventRequirements(eventId: string): Promise<ReadinessRequirement[]>;

  /** The event's resources that are set up (B3-05). Types with no row are "Not set up". */
  listResources(eventId: string): Promise<ResourceRecord[]>;
  findResource(eventId: string, type: ResourceType): Promise<ResourceRecord | null>;
  createResource(args: {
    eventId: string;
    type: ResourceType;
    actorId: string;
    input: ResourceInput;
  }): Promise<CreateResourceResult>;
  /** Saves only if `version` is still current (D-032); `changes` is recorded in the audit log. */
  updateResource(args: {
    eventId: string;
    type: ResourceType;
    actorId: string;
    version: Date;
    input: ResourceInput;
    changes: ResourceChanges;
  }): Promise<UpdateResourceResult>;
  deleteResource(args: {
    eventId: string;
    type: ResourceType;
    actorId: string;
  }): Promise<DeleteResourceResult>;
}