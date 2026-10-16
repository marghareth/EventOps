// src/modules/events/budget/infrastructure/prisma-budget-repository.ts
// The budget repository on PostgreSQL through Prisma (D-001; B5-F01, B5-F02; D-084, D-085). Every
// query filters by the event ID. Every write re-checks, in storage, that the actor is a member
// whose role may manage the budget (D-035), refuses a stale save (D-032) and records its audit
// entry in the same transaction (D-037), so a change and its entry are saved together or not at all.
// The caller must have authenticated the actor and authorized with authorizeEvent (D-036).
import "server-only";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import type { BudgetRepository, CategoryRecord, ItemRecord } from "../application/ports";
import { formatBudgetItemReference } from "../domain/budget.item";

const CATEGORY_SELECT = { id: true, name: true, allocationAmount: true, updatedAt: true } as const;
const ITEM_SELECT = {
  id: true,
  number: true,
  categoryId: true,
  name: true,
  estimatedAmount: true,
  committedAmount: true,
  paidAmount: true,
  notes: true,
  updatedAt: true,
} as const;

type Money = { toFixed(digits: number): string };

function toCategory(row: {
  id: string;
  name: string;
  allocationAmount: Money;
  updatedAt: Date;
}): CategoryRecord {
  return {
    id: row.id,
    name: row.name,
    allocation: row.allocationAmount.toFixed(2),
    updatedAt: row.updatedAt,
  };
}

function toItem(row: {
  id: string;
  number: number;
  categoryId: string;
  name: string;
  estimatedAmount: Money;
  committedAmount: Money;
  paidAmount: Money;
  notes: string | null;
  updatedAt: Date;
}): ItemRecord {
  return {
    id: row.id,
    number: row.number,
    categoryId: row.categoryId,
    name: row.name,
    estimated: row.estimatedAmount.toFixed(2),
    committed: row.committedAmount.toFixed(2),
    paid: row.paidAmount.toFixed(2),
    notes: row.notes,
    updatedAt: row.updatedAt,
  };
}

/** Prisma's error code for a unique constraint violation (including the case-insensitive name). */
const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

/** Prisma's error code for a foreign key violation (a category that still has items). */
const isForeignKeyViolation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2003";

export function prismaBudgetRepository(db: PrismaClient): BudgetRepository {
  const roles = () => [...rolesAllowed("budget.manage")];
  /** The event-and-role condition every write repeats, so a role change in between writes nothing. */
  const allowed = (eventId: string, actorId: string) => ({
    eventId,
    event: { members: { some: { userId: actorId, role: { in: roles() } } } },
  });

  return {
    async listBudget(eventId) {
      const rows = await db.budgetCategory.findMany({
        where: { eventId },
        select: {
          ...CATEGORY_SELECT,
          items: { where: { eventId }, select: ITEM_SELECT, orderBy: { number: "asc" } },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });
      return rows.map(({ items, ...category }) => ({
        ...toCategory(category),
        items: items.map(toItem),
      }));
    },

    async findCategory(eventId, categoryId) {
      const row = await db.budgetCategory.findFirst({
        where: { id: categoryId, eventId },
        select: CATEGORY_SELECT,
      });
      return row ? toCategory(row) : null;
    },

    async findItem(eventId, itemId) {
      const row = await db.budgetItem.findFirst({
        where: { id: itemId, eventId },
        select: { ...ITEM_SELECT, category: { select: { name: true } } },
      });
      return row ? { ...toItem(row), categoryName: row.category.name } : null;
    },

    async createCategory({ eventId, actorId, input }) {
      try {
        return await db.$transaction(async (tx) => {
          const member = await tx.event.findFirst({
            where: {
              id: eventId,
              members: { some: { userId: actorId, role: { in: roles() } } },
            },
            select: { id: true },
          });
          if (!member) return { ok: false, reason: "not-found" } as const;
          const created = await tx.budgetCategory.create({
            data: { eventId, name: input.name, allocationAmount: input.allocation },
            select: { id: true },
          });
          await writeAudit(tx, {
            eventId,
            actorId,
            action: "budget_category.created",
            entityId: created.id,
            details: { name: input.name, allocation: input.allocation },
          });
          return { ok: true, id: created.id } as const;
        });
      } catch (error) {
        if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
        throw error;
      }
    },

    async updateCategory({ eventId, categoryId, actorId, version, input, changes }) {
      const guard = allowed(eventId, actorId);
      const where = { id: categoryId, updatedAt: version, ...guard };
      try {
        return await db.$transaction(async (tx) => {
          const before = await tx.budgetCategory.findFirst({ where, select: { id: true } });
          // The conditional update repeats every check, so a change in between updates nothing.
          const { count } = before
            ? await tx.budgetCategory.updateMany({
                where,
                data: { name: input.name, allocationAmount: input.allocation },
              })
            : { count: 0 };
          if (!before || count !== 1) {
            const stillEditable = await tx.budgetCategory.count({
              where: { id: categoryId, ...guard },
            });
            return { ok: false, reason: stillEditable ? "stale" : "not-found" } as const;
          }
          await writeAudit(tx, {
            eventId,
            actorId,
            action: "budget_category.updated",
            entityId: categoryId,
            details: { name: input.name, changes },
          });
          return { ok: true } as const;
        });
      } catch (error) {
        if (isUniqueViolation(error)) return { ok: false, reason: "duplicate" };
        throw error;
      }
    },

    async deleteCategory({ eventId, categoryId, actorId }) {
      const guard = allowed(eventId, actorId);
      try {
        return await db.$transaction(async (tx) => {
          const category = await tx.budgetCategory.findFirst({
            where: { id: categoryId, ...guard },
            select: { name: true, allocationAmount: true },
          });
          if (!category) return { ok: false, reason: "not-found" } as const;
          const count = await tx.budgetItem.count({ where: { eventId, categoryId } });
          if (count > 0) return { ok: false, reason: "not-empty", count } as const;
          const { count: removed } = await tx.budgetCategory.deleteMany({
            where: { id: categoryId, ...guard },
          });
          if (removed !== 1) return { ok: false, reason: "not-found" } as const;
          await writeAudit(tx, {
            eventId,
            actorId,
            action: "budget_category.deleted",
            entityId: categoryId,
            details: { name: category.name, allocation: category.allocationAmount.toFixed(2) },
          });
          return { ok: true, name: category.name } as const;
        });
      } catch (error) {
        // An item was added after the check: the foreign key refused the delete.
        if (isForeignKeyViolation(error)) {
          const count = await db.budgetItem.count({ where: { eventId, categoryId } });
          return { ok: false, reason: "not-empty", count: Math.max(count, 1) };
        }
        throw error;
      }
    },

    async createItem({ eventId, actorId, input }) {
      const memberRoles = roles() as MemberRole[];
      return db.$transaction(async (tx) => {
        // The category is looked up first, inside this event and for an authorized actor, so a
        // refusal never uses up an item number.
        const category = await tx.budgetCategory.findFirst({
          where: { id: input.categoryId, ...allowed(eventId, actorId) },
          select: { name: true },
        });
        if (!category) return { ok: false, reason: "not-found" } as const;

        // Raw SQL so the event's updatedAt (its edit version, D-032) does not move. The row stays
        // locked until commit, so concurrent additions get distinct numbers. The same statement
        // checks the role again.
        const [counter] = await tx.$queryRaw<{ lastBudgetItemNumber: number }[]>`
          UPDATE events SET "lastBudgetItemNumber" = "lastBudgetItemNumber" + 1
          WHERE id = ${eventId}::uuid
            AND EXISTS (
              SELECT 1 FROM event_members m
              WHERE m."eventId" = events.id AND m."userId" = ${actorId}::uuid
                AND m.role = ANY(${memberRoles}::member_role[])
            )
          RETURNING "lastBudgetItemNumber"`;
        if (!counter) return { ok: false, reason: "not-found" } as const;

        const created = await tx.budgetItem.create({
          data: {
            eventId,
            categoryId: input.categoryId,
            number: counter.lastBudgetItemNumber,
            name: input.name,
            estimatedAmount: input.estimated,
            committedAmount: input.committed,
            paidAmount: input.paid,
            notes: input.notes,
          },
          select: { id: true, number: true },
        });
        await writeAudit(tx, {
          eventId,
          actorId,
          action: "budget_item.created",
          entityId: created.id,
          details: {
            reference: formatBudgetItemReference(created.number),
            name: input.name,
            category: category.name,
            estimated: input.estimated,
            committed: input.committed,
            paid: input.paid,
          },
        });
        return { ok: true, id: created.id, number: created.number } as const;
      });
    },

    async updateItem({ eventId, itemId, actorId, version, input, changes }) {
      const guard = allowed(eventId, actorId);
      const where = { id: itemId, updatedAt: version, ...guard };
      return db.$transaction(async (tx) => {
        const before = await tx.budgetItem.findFirst({ where, select: { number: true } });
        // An explicit list of editable fields: nothing else from the input can reach the row. The
        // composite foreign key refuses a category from another event.
        const { count } = before
          ? await tx.budgetItem.updateMany({
              where,
              data: {
                categoryId: input.categoryId,
                name: input.name,
                estimatedAmount: input.estimated,
                committedAmount: input.committed,
                paidAmount: input.paid,
                notes: input.notes,
              },
            })
          : { count: 0 };
        if (!before || count !== 1) {
          const stillEditable = await tx.budgetItem.count({ where: { id: itemId, ...guard } });
          return { ok: false, reason: stillEditable ? "stale" : "not-found" } as const;
        }
        await writeAudit(tx, {
          eventId,
          actorId,
          action: "budget_item.updated",
          entityId: itemId,
          details: { reference: formatBudgetItemReference(before.number), changes },
        });
        return { ok: true } as const;
      });
    },

    async deleteItem({ eventId, itemId, actorId }) {
      const where = { id: itemId, ...allowed(eventId, actorId) };
      return db.$transaction(async (tx) => {
        const item = await tx.budgetItem.findFirst({ where, select: { number: true, name: true } });
        const { count } = item ? await tx.budgetItem.deleteMany({ where }) : { count: 0 };
        if (!item || count !== 1) return { ok: false, reason: "not-found" } as const;
        await writeAudit(tx, {
          eventId,
          actorId,
          action: "budget_item.deleted",
          entityId: itemId,
          details: { reference: formatBudgetItemReference(item.number), name: item.name },
        });
        return { ok: true, number: item.number, name: item.name } as const;
      });
    },
  };
}