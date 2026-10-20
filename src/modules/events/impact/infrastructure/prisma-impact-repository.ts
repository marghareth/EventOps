// src/modules/events/impact/infrastructure/prisma-impact-repository.ts
// Impact assumptions and saved analyses on PostgreSQL through Prisma (D-102, D-103). Every query
// filters by the event ID. Every write re-checks, in storage, that the actor is a member whose role
// has the permission (D-035), and records its audit entry in the same transaction (D-037). The
// caller must have authenticated the actor and authorized with authorizeEvent (D-036).
import "server-only";
import type { MemberRole, Prisma, PrismaClient } from "@/generated/prisma/client";
import { writeAudit, type ImpactAssumptionChanges } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import type { ImpactAssumptions } from "../domain/assumptions";
import { changedAssumptions } from "../domain/assumptions";
import { impactSnapshotSchema } from "../schema";
import type { AssumptionsRecord, ImpactRepository } from "../application/ports";

/** The saved analysis's readable ID, for example IMP-0001 (D-103). */
export const formatImpactReference = (number: number) => `IMP-${String(number).padStart(4, "0")}`;

const decimal = (value: Prisma.Decimal | null) => (value === null ? null : value.toFixed(2));

const NONE: AssumptionsRecord = {
  cateringCostPerHead: null,
  accessibleSeatsPer100: null,
  cateringCategoryId: null,
  cateringCategoryName: null,
  updatedAt: null,
};

class Refused extends Error {
  constructor(readonly reason: "stale" | "forbidden" | "category-not-found") {
    super(reason);
  }
}

export function prismaImpactRepository(db: PrismaClient): ImpactRepository {
  type Tx = Prisma.TransactionClient;
  const isMember = async (tx: Tx, eventId: string, actorId: string, roles: readonly MemberRole[]) =>
    (await tx.eventMember.count({
      where: { eventId, userId: actorId, role: { in: [...roles] } },
    })) > 0;

  async function readAssumptions(client: Tx | PrismaClient, eventId: string) {
    const row = await client.eventImpactAssumptions.findUnique({
      where: { eventId },
      select: {
        cateringCostPerHead: true,
        accessibleSeatsPer100: true,
        cateringCategoryId: true,
        updatedAt: true,
        cateringCategory: { select: { name: true } },
      },
    });
    if (!row) return NONE;
    return {
      cateringCostPerHead: decimal(row.cateringCostPerHead),
      accessibleSeatsPer100: decimal(row.accessibleSeatsPer100),
      cateringCategoryId: row.cateringCategoryId,
      cateringCategoryName: row.cateringCategory?.name ?? null,
      updatedAt: row.updatedAt,
    } satisfies AssumptionsRecord;
  }

  return {
    getAssumptions: (eventId) => readAssumptions(db, eventId),

    async saveAssumptions({ eventId, actorId, version, input }) {
      try {
        return await db.$transaction(async (tx) => {
          if (!(await isMember(tx, eventId, actorId, rolesAllowed("impact.assumptions")))) {
            throw new Refused("forbidden");
          }
          const before = await readAssumptions(tx, eventId);
          if ((before.updatedAt?.getTime() ?? null) !== (version?.getTime() ?? null)) {
            throw new Refused("stale");
          }

          let categoryName: string | null = null;
          if (input.cateringCategoryId !== null) {
            const category = await tx.budgetCategory.findFirst({
              where: { id: input.cateringCategoryId, eventId },
              select: { name: true },
            });
            if (!category) throw new Refused("category-not-found");
            categoryName = category.name;
          }

          const changed = changedAssumptions(before, input);
          if (changed.length === 0) return { ok: true, changed: false } as const;

          const data = {
            cateringCostPerHead: input.cateringCostPerHead,
            accessibleSeatsPer100: input.accessibleSeatsPer100,
            cateringCategoryId: input.cateringCategoryId,
          };
          if (before.updatedAt === null) {
            await tx.eventImpactAssumptions.create({ data: { eventId, ...data } });
          } else {
            // Only if nobody saved in between (D-032).
            const { count } = await tx.eventImpactAssumptions.updateMany({
              where: { eventId, updatedAt: before.updatedAt },
              data,
            });
            if (count !== 1) throw new Refused("stale");
          }

          const changes: ImpactAssumptionChanges = {};
          const pair = <T>(from: T, to: T) => ({ from, to });
          for (const key of changed) {
            if (key === "cateringCategoryId") {
              changes.cateringCategory = pair(
                before.cateringCategoryId ? before.cateringCategoryName : null,
                categoryName,
              );
            } else {
              changes[key] = pair(before[key], input[key as keyof ImpactAssumptions]);
            }
          }
          await writeAudit(tx, {
            eventId,
            actorId,
            action: "impact_assumptions.updated",
            entityId: eventId,
            details: { changes },
          });
          return { ok: true, changed: true } as const;
        });
      } catch (error) {
        if (error instanceof Refused) return { ok: false, reason: error.reason };
        // Two first saves at once: the second hits the primary key. Treat it as stale (D-032).
        if ((error as { code?: string }).code === "P2002") return { ok: false, reason: "stale" };
        throw error;
      }
    },

    async listAnalyses(eventId, limit) {
      const rows = await db.impactAnalysis.findMany({
        where: { eventId },
        orderBy: [{ number: "desc" }],
        take: limit,
        select: {
          id: true,
          number: true,
          createdAt: true,
          result: true,
          createdBy: { select: { displayName: true } },
        },
      });
      // Every stored snapshot is checked again on read; one that doesn't fit is left out, never
      // shown half-understood.
      return rows.flatMap((row) => {
        const snapshot = impactSnapshotSchema.safeParse(row.result);
        if (!snapshot.success) return [];
        return [
          {
            id: row.id,
            number: row.number,
            createdAt: row.createdAt,
            createdByName: row.createdBy?.displayName ?? null,
            snapshot: snapshot.data,
          },
        ];
      });
    },

    async saveAnalysis({ eventId, actorId, snapshot }) {
      const valid = impactSnapshotSchema.parse(snapshot);
      const roles = [...rolesAllowed("impact.record")] as MemberRole[];
      return db.$transaction(async (tx) => {
        // Raw SQL so the event's updatedAt (its edit version, D-032) does not move. The row stays
        // locked until commit, so concurrent saves get distinct numbers. The same statement checks
        // the role, so a refusal never uses up a number.
        const [counter] = await tx.$queryRaw<{ lastImpactNumber: number }[]>`
          UPDATE events SET "lastImpactNumber" = "lastImpactNumber" + 1
          WHERE id = ${eventId}::uuid
            AND EXISTS (
              SELECT 1 FROM event_members m
              WHERE m."eventId" = events.id AND m."userId" = ${actorId}::uuid
                AND m.role = ANY(${roles}::member_role[])
            )
          RETURNING "lastImpactNumber"`;
        if (!counter) return { ok: false, reason: "forbidden" } as const;

        const created = await tx.impactAnalysis.create({
          data: {
            eventId,
            number: counter.lastImpactNumber,
            fromAttendees: valid.from,
            toAttendees: valid.to,
            overallSeverity: valid.overall,
            result: valid as Prisma.InputJsonValue,
            createdById: actorId,
          },
          select: { id: true, number: true },
        });
        await writeAudit(tx, {
          eventId,
          actorId,
          action: "impact_analysis.created",
          entityId: created.id,
          details: {
            reference: formatImpactReference(created.number),
            from: valid.from,
            to: valid.to,
            overall: valid.overall,
          },
        });
        return { ok: true, number: created.number } as const;
      });
    },
  };
}