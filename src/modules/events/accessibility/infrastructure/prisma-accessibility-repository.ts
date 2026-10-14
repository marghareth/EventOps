// src/modules/events/accessibility/infrastructure/prisma-accessibility-repository.ts
// The accessibility repository on PostgreSQL (B3-03, B3-05, D-056). Every query filters by the event; every
// write also checks, in the same statement, that the actor is a member whose role may manage
// accessibility (rolesAllowed, D-035), so a role changed after authorizeEvent changes nothing. Each
// write and its audit entry share one transaction (D-037). Requirements reach attendees only
// through (eventId, attendeeId), which the composite foreign key also enforces (D-002).
import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { formatAttendeeReference } from "@/modules/events/attendees/public";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import type {
  AccessibilityRepository,
  CreateRequirementResult,
  CreateResourceResult,
  DeleteRequirementResult,
  DeleteResourceResult,
  RequirementRecord,
  UpdateRequirementResult,
  UpdateResourceResult,
} from "../application/ports";
import { REQUIREMENT_TYPES } from "../domain/requirement-type";
import { RESOURCE_TYPES } from "../domain/resource";

/** The actor is a member of the event with a role that may manage accessibility. */
const managedBy = (userId: string) => ({
  members: { some: { userId, role: { in: [...rolesAllowed("accessibility.manage")] } } },
});

/** Postgres refused a duplicate (unique (eventId, attendeeId, type)), for example in a race. */
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

const byDefinitionOrder = (a: RequirementRecord, b: RequirementRecord) =>
  REQUIREMENT_TYPES.indexOf(a.type) - REQUIREMENT_TYPES.indexOf(b.type);

const RESOURCE_FIELDS = {
  id: true,
  type: true,
  status: true,
  quantity: true,
  note: true,
  updatedAt: true,
} as const;

const REQUIREMENT_FIELDS = {
  id: true,
  attendeeId: true,
  type: true,
  priority: true,
  updatedAt: true,
} as const;

export function prismaAccessibilityRepository(db: PrismaClient): AccessibilityRepository {
  return {
    async findAttendee(eventId, attendeeId) {
      return db.attendee.findFirst({
        where: { id: attendeeId, eventId },
        select: { id: true, number: true, name: true },
      });
    },

    async listRequirements(eventId, attendeeId, { withNotes }) {
      const rows = await db.accessibilityRequirement.findMany({
        where: { eventId, attendeeId },
        // The note is loaded only for roles that may see it (D-058).
        select: { ...REQUIREMENT_FIELDS, note: withNotes },
      });
      return rows
        .map(({ note, ...row }): RequirementRecord =>
          withNotes ? { ...row, note: note ?? null } : row,
        )
        .sort(byDefinitionOrder);
    },

    async findRequirement(eventId, attendeeId, requirementId) {
      return db.accessibilityRequirement.findFirst({
        where: { id: requirementId, eventId, attendeeId },
        select: { ...REQUIREMENT_FIELDS, note: true },
      });
    },

    async createRequirement({ eventId, attendeeId, actorId, input }) {
      try {
        return await db.$transaction(async (tx): Promise<CreateRequirementResult> => {
          const attendee = await tx.attendee.findFirst({
            where: { id: attendeeId, eventId, event: managedBy(actorId) },
            select: { number: true },
          });
          if (!attendee) return { ok: false, reason: "not-found" };
          const existing = await tx.accessibilityRequirement.findFirst({
            where: { eventId, attendeeId, type: input.type },
            select: { id: true },
          });
          if (existing) return { ok: false, reason: "duplicate" };
          const created = await tx.accessibilityRequirement.create({
            data: { eventId, attendeeId, ...input },
            select: { id: true },
          });
          await writeAudit(tx, {
            eventId,
            actorId,
            action: "accessibility_requirement.created",
            entityId: created.id,
            details: {
              reference: formatAttendeeReference(attendee.number),
              type: input.type,
              priority: input.priority,
            },
          });
          return { ok: true, id: created.id };
        });
      } catch (error) {
        if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
        throw error;
      }
    },

    async updateRequirement({
      eventId,
      attendeeId,
      requirementId,
      actorId,
      version,
      input,
      changes,
    }) {
      const allowed = { id: requirementId, eventId, attendeeId, event: managedBy(actorId) };
      const where = { ...allowed, updatedAt: version };
      try {
        return await db.$transaction(async (tx): Promise<UpdateRequirementResult> => {
          const before = await tx.accessibilityRequirement.findFirst({
            where,
            select: { attendee: { select: { number: true } } },
          });
          // The conditional update repeats every check, so a change in between updates nothing.
          const { count } = before
            ? await tx.accessibilityRequirement.updateMany({ where, data: input })
            : { count: 0 };
          if (!before || count !== 1) {
            const stillEditable = await tx.accessibilityRequirement.count({ where: allowed });
            return { ok: false, reason: stillEditable ? "stale" : "not-found" };
          }
          await writeAudit(tx, {
            eventId,
            actorId,
            action: "accessibility_requirement.updated",
            entityId: requirementId,
            details: {
              reference: formatAttendeeReference(before.attendee.number),
              type: input.type,
              changes,
            },
          });
          return { ok: true };
        });
      } catch (error) {
        if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
        throw error;
      }
    },

    async deleteRequirement({ eventId, attendeeId, requirementId, actorId }) {
      const where = { id: requirementId, eventId, attendeeId, event: managedBy(actorId) };
      return db.$transaction(async (tx): Promise<DeleteRequirementResult> => {
        const requirement = await tx.accessibilityRequirement.findFirst({
          where,
          select: { type: true, attendee: { select: { number: true } } },
        });
        const { count } = requirement
          ? await tx.accessibilityRequirement.deleteMany({ where })
          : { count: 0 };
        if (!requirement || count !== 1) return { ok: false, reason: "not-found" };
        await writeAudit(tx, {
          eventId,
          actorId,
          action: "accessibility_requirement.deleted",
          entityId: requirementId,
          details: {
            reference: formatAttendeeReference(requirement.attendee.number),
            type: requirement.type,
          },
        });
        return { ok: true, type: requirement.type };
      });
    },

    async listResources(eventId) {
      const rows = await db.accessibilityResource.findMany({
        where: { eventId },
        select: RESOURCE_FIELDS,
      });
      return rows.sort((a, b) => RESOURCE_TYPES.indexOf(a.type) - RESOURCE_TYPES.indexOf(b.type));
    },

    async findResource(eventId, type) {
      return db.accessibilityResource.findFirst({
        where: { eventId, type },
        select: RESOURCE_FIELDS,
      });
    },

    async createResource({ eventId, type, actorId, input }) {
      try {
        return await db.$transaction(async (tx): Promise<CreateResourceResult> => {
          const event = await tx.event.findFirst({
            where: { id: eventId, ...managedBy(actorId) },
            select: { id: true },
          });
          if (!event) return { ok: false, reason: "not-found" };
          const existing = await tx.accessibilityResource.findFirst({
            where: { eventId, type },
            select: { id: true },
          });
          if (existing) return { ok: false, reason: "exists" };
          const created = await tx.accessibilityResource.create({
            data: { eventId, type, ...input },
            select: { id: true },
          });
          await writeAudit(tx, {
            eventId,
            actorId,
            action: "accessibility_resource.created",
            entityId: created.id,
            details: { type, status: input.status, quantity: input.quantity },
          });
          return { ok: true };
        });
      } catch (error) {
        if (isUniqueViolation(error)) return { ok: false, reason: "exists" };
        throw error;
      }
    },

    async updateResource({ eventId, type, actorId, version, input, changes }) {
      const allowed = { eventId, type, event: managedBy(actorId) };
      const where = { ...allowed, updatedAt: version };
      return db.$transaction(async (tx): Promise<UpdateResourceResult> => {
        const before = await tx.accessibilityResource.findFirst({ where, select: { id: true } });
        // The conditional update repeats every check, so a change in between updates nothing.
        const { count } = before
          ? await tx.accessibilityResource.updateMany({ where, data: input })
          : { count: 0 };
        if (!before || count !== 1) {
          const stillEditable = await tx.accessibilityResource.count({ where: allowed });
          return { ok: false, reason: stillEditable ? "stale" : "not-found" };
        }
        await writeAudit(tx, {
          eventId,
          actorId,
          action: "accessibility_resource.updated",
          entityId: before.id,
          details: { type, changes },
        });
        return { ok: true };
      });
    },

    async deleteResource({ eventId, type, actorId }) {
      const where = { eventId, type, event: managedBy(actorId) };
      return db.$transaction(async (tx): Promise<DeleteResourceResult> => {
        const resource = await tx.accessibilityResource.findFirst({ where, select: { id: true } });
        const { count } = resource
          ? await tx.accessibilityResource.deleteMany({ where })
          : { count: 0 };
        if (!resource || count !== 1) return { ok: false, reason: "not-found" };
        await writeAudit(tx, {
          eventId,
          actorId,
          action: "accessibility_resource.deleted",
          entityId: resource.id,
          details: { type },
        });
        return { ok: true };
      });
    },
  };
}