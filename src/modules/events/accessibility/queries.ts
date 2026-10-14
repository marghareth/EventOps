// src/modules/events/accessibility/queries.ts
// Accessibility reads for pages (B3-03, B3-04). Each one authorizes itself (D-036): every member may
// read an attendee's requirements (event.view); notes are loaded only for roles with
// accessibility.private (D-058); the edit and add forms need accessibility.manage. The attendee and
// the requirement are found only inside the authorized event, so another event's IDs are "not found".
import "server-only";
import { z } from "zod";
import { authorizeEvent, can, type EventAuthorization } from "@/modules/events/public";
import type {
  AttendeeIdentity,
  FullRequirementRecord,
  RequirementRecord,
  ResourceRecord,
} from "./application/ports";
import { accessibilityRepository } from "./composition";
import type { RequirementType } from "./domain/requirement-type";
import { RESOURCE_TYPES, resourceTypeFromSlug, type ResourceType } from "./domain/resource";

type Refused = { ok: false; reason: Extract<EventAuthorization, { ok: false }>["reason"] };

const idSchema = z.uuid();
const attendeesPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/attendees`;

export type AttendeeAccessibility =
  | {
      ok: true;
      requirements: RequirementRecord[];
      /** Whether the reader may see notes (accessibility.private, D-058). */
      showNotes: boolean;
      /** Whether the reader may add, edit and remove (accessibility.manage). */
      canManage: boolean;
    }
  | Refused;

/** An attendee's requirements for the details page (B3-04). Every member. */
export async function getAttendeeAccessibility(
  eventId: string,
  attendeeId: string,
): Promise<AttendeeAccessibility> {
  const auth = await authorizeEvent(eventId, "event.view", attendeesPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  if (!idSchema.safeParse(attendeeId).success) return { ok: false, reason: "not-found" };
  const repository = accessibilityRepository();
  if (!(await repository.findAttendee(auth.event.id, attendeeId))) {
    return { ok: false, reason: "not-found" };
  }
  const showNotes = can(auth.event.role, "accessibility.private");
  const requirements = await repository.listRequirements(auth.event.id, attendeeId, {
    withNotes: showNotes,
  });
  return {
    ok: true,
    requirements,
    showNotes,
    canManage: can(auth.event.role, "accessibility.manage"),
  };
}

export type NewRequirementContext =
  { ok: true; attendee: AttendeeIdentity; takenTypes: RequirementType[] } | Refused;

/** The attendee for the add form, and the types they already have (one per type, D-056). */
export async function getNewRequirementContext(
  eventId: string,
  attendeeId: string,
): Promise<NewRequirementContext> {
  const auth = await authorizeEvent(eventId, "accessibility.manage", attendeesPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  if (!idSchema.safeParse(attendeeId).success) return { ok: false, reason: "not-found" };
  const repository = accessibilityRepository();
  const attendee = await repository.findAttendee(auth.event.id, attendeeId);
  if (!attendee) return { ok: false, reason: "not-found" };
  const existing = await repository.listRequirements(auth.event.id, attendeeId, {
    withNotes: false,
  });
  return { ok: true, attendee, takenTypes: existing.map((r) => r.type) };
}

export type RequirementForEditing =
  | {
      ok: true;
      attendee: AttendeeIdentity;
      requirement: FullRequirementRecord;
      /** Types this attendee already has besides this requirement. */
      takenTypes: RequirementType[];
    }
  | Refused;

/** One requirement for the edit form (B3-04). accessibility.manage; this attendee and event only. */
export async function getRequirementForEditing(
  eventId: string,
  attendeeId: string,
  requirementId: string,
): Promise<RequirementForEditing> {
  const auth = await authorizeEvent(eventId, "accessibility.manage", attendeesPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  if (!idSchema.safeParse(attendeeId).success || !idSchema.safeParse(requirementId).success) {
    return { ok: false, reason: "not-found" };
  }
  const repository = accessibilityRepository();
  const attendee = await repository.findAttendee(auth.event.id, attendeeId);
  const requirement = attendee
    ? await repository.findRequirement(auth.event.id, attendeeId, requirementId)
    : null;
  if (!attendee || !requirement) return { ok: false, reason: "not-found" };
  const others = await repository.listRequirements(auth.event.id, attendeeId, {
    withNotes: false,
  });
  return {
    ok: true,
    attendee,
    requirement,
    takenTypes: others.filter((r) => r.id !== requirement.id).map((r) => r.type),
  };
}

// ───────────────────────── Event resources (B3-05) ─────────────────────────

const accessibilityPath = (eventId: string) =>
  `/events/${encodeURIComponent(eventId)}/accessibility`;

export type EventResources =
  | {
      ok: true;
      /** All six types in definition order; `resource` is null when it is "Not set up". */
      resources: { type: ResourceType; resource: ResourceRecord | null }[];
      /** Whether the reader may set up, edit and remove (accessibility.manage). */
      canManage: boolean;
    }
  | Refused;

/**
 * The event's accessibility resources for the Accessibility page. Every member (event.view):
 * resources describe the venue, not a person, so the whole record is shown to every member.
 */
export async function getEventResources(eventId: string): Promise<EventResources> {
  const auth = await authorizeEvent(eventId, "event.view", accessibilityPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const stored = await accessibilityRepository().listResources(auth.event.id);
  return {
    ok: true,
    resources: RESOURCE_TYPES.map((type) => ({
      type,
      resource: stored.find((r) => r.type === type) ?? null,
    })),
    canManage: can(auth.event.role, "accessibility.manage"),
  };
}

export type ResourceForEditing =
  { ok: true; type: ResourceType; resource: ResourceRecord | null } | Refused;

/**
 * One resource type for its form, by the address segment (for example "accessible-seats").
 * accessibility.manage. An unknown segment is "not found"; a type with no record is offered for
 * setting up (`resource` null).
 */
export async function getResourceForEditing(
  eventId: string,
  slug: string,
): Promise<ResourceForEditing> {
  const auth = await authorizeEvent(eventId, "accessibility.manage", accessibilityPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const type = resourceTypeFromSlug(slug);
  if (!type) return { ok: false, reason: "not-found" };
  const resource = await accessibilityRepository().findResource(auth.event.id, type);
  return { ok: true, type, resource };
}