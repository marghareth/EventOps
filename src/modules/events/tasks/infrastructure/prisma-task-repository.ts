// src/modules/events/tasks/infrastructure/prisma-task-repository.ts
// The task repository on PostgreSQL through Prisma (D-001; B6-F01, B6-F02; D-094). Every query
// filters by the event ID. Every write re-checks, in storage, that the actor is a member whose role
// may manage tasks (D-035), refuses a stale save (D-032) and records its audit entry in the same
// transaction (D-037), so a change and its entry are saved together or not at all. The caller must
// have authenticated the actor and authorized with authorizeEvent (D-036).
import "server-only";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import type { TaskRepository } from "../application/ports";
import { formatTaskReference } from "../domain/task";

const TASK_SELECT = {
  id: true,
  number: true,
  title: true,
  description: true,
  updatedAt: true,
} as const;

export function prismaTaskRepository(db: PrismaClient): TaskRepository {
  const roles = () => [...rolesAllowed("tasks.manage")];
  /** The event-and-role condition every write repeats, so a role change in between writes nothing. */
  const allowed = (eventId: string, actorId: string) => ({
    eventId,
    event: { members: { some: { userId: actorId, role: { in: roles() } } } },
  });

  return {
    async listTasks(eventId) {
      return db.task.findMany({
        where: { eventId },
        select: TASK_SELECT,
        orderBy: [{ number: "asc" }],
      });
    },

    async findTask(eventId, taskId) {
      return db.task.findFirst({ where: { id: taskId, eventId }, select: TASK_SELECT });
    },

    async createTask({ eventId, actorId, input }) {
      const memberRoles = roles() as MemberRole[];
      return db.$transaction(async (tx) => {
        // Raw SQL so the event's updatedAt (its edit version, D-032) does not move. The row stays
        // locked until commit, so concurrent additions get distinct numbers. The same statement
        // checks the role, so a refusal never uses up a number.
        const [counter] = await tx.$queryRaw<{ lastTaskNumber: number }[]>`
          UPDATE events SET "lastTaskNumber" = "lastTaskNumber" + 1
          WHERE id = ${eventId}::uuid
            AND EXISTS (
              SELECT 1 FROM event_members m
              WHERE m."eventId" = events.id AND m."userId" = ${actorId}::uuid
                AND m.role = ANY(${memberRoles}::member_role[])
            )
          RETURNING "lastTaskNumber"`;
        if (!counter) return { ok: false, reason: "not-found" } as const;

        const created = await tx.task.create({
          data: {
            eventId,
            number: counter.lastTaskNumber,
            title: input.title,
            description: input.description,
          },
          select: { id: true, number: true },
        });
        await writeAudit(tx, {
          eventId,
          actorId,
          action: "task.created",
          entityId: created.id,
          details: { reference: formatTaskReference(created.number), title: input.title },
        });
        return { ok: true, id: created.id, number: created.number } as const;
      });
    },

    async updateTask({ eventId, taskId, actorId, version, input, changes }) {
      const guard = allowed(eventId, actorId);
      const where = { id: taskId, updatedAt: version, ...guard };
      return db.$transaction(async (tx) => {
        const before = await tx.task.findFirst({ where, select: { number: true } });
        // An explicit list of editable fields: nothing else from the input can reach the row. The
        // conditional update repeats every check, so a change in between updates nothing.
        const { count } = before
          ? await tx.task.updateMany({
              where,
              data: { title: input.title, description: input.description },
            })
          : { count: 0 };
        if (!before || count !== 1) {
          const stillEditable = await tx.task.count({ where: { id: taskId, ...guard } });
          return { ok: false, reason: stillEditable ? "stale" : "not-found" } as const;
        }
        await writeAudit(tx, {
          eventId,
          actorId,
          action: "task.updated",
          entityId: taskId,
          details: {
            reference: formatTaskReference(before.number),
            title: input.title,
            changes,
          },
        });
        return { ok: true } as const;
      });
    },
  };
}