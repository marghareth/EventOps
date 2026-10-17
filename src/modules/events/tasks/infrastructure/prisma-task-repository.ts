// src/modules/events/tasks/infrastructure/prisma-task-repository.ts
// The task repository on PostgreSQL through Prisma (D-001; B6-F01 to B6-F05; D-094, D-095). Every
// query filters by the event ID. Every write re-checks, in storage, that the actor is a member whose
// role may manage tasks (D-035), refuses a stale save (D-032) and records its audit entry in the same
// transaction (D-037), so a change and its entry are saved together or not at all. An assignee is
// looked up inside the same event in the same transaction, and the composite foreign key on
// (eventId, assigneeId) refuses a member of another event again. The caller must have authenticated
// the actor and authorized with authorizeEvent (D-036).
import "server-only";
import type { MemberRole, PrismaClient } from "@/generated/prisma/client";
import { writeAudit } from "@/modules/events/audit/public";
import { rolesAllowed } from "@/modules/events/public";
import type { AssignableMember, TaskRecord, TaskRepository } from "../application/ports";
import { formatTaskReference } from "../domain/task";

const TASK_SELECT = {
  id: true,
  number: true,
  title: true,
  description: true,
  priority: true,
  updatedAt: true,
  assignee: { select: { id: true, user: { select: { displayName: true } } } },
} as const;

type TaskRow = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  priority: TaskRecord["priority"];
  updatedAt: Date;
  assignee: { id: string; user: { displayName: string } } | null;
};

const toRecord = (row: TaskRow): TaskRecord => ({
  id: row.id,
  number: row.number,
  title: row.title,
  description: row.description,
  priority: row.priority,
  assignee: row.assignee ? { id: row.assignee.id, name: row.assignee.user.displayName } : null,
  updatedAt: row.updatedAt,
});

const MEMBER_SELECT = { id: true, role: true, user: { select: { displayName: true } } } as const;
const toMember = (row: {
  id: string;
  role: MemberRole;
  user: { displayName: string };
}): AssignableMember => ({ id: row.id, name: row.user.displayName, role: row.role });

export function prismaTaskRepository(db: PrismaClient): TaskRepository {
  const roles = () => [...rolesAllowed("tasks.manage")];
  /** The event-and-role condition every write repeats, so a role change in between writes nothing. */
  const allowed = (eventId: string, actorId: string) => ({
    eventId,
    event: { members: { some: { userId: actorId, role: { in: roles() } } } },
  });

  return {
    async listTasks(eventId) {
      const rows = await db.task.findMany({
        where: { eventId },
        select: TASK_SELECT,
        orderBy: [{ number: "asc" }],
      });
      return rows.map(toRecord);
    },

    async findTask(eventId, taskId) {
      const row = await db.task.findFirst({ where: { id: taskId, eventId }, select: TASK_SELECT });
      return row ? toRecord(row) : null;
    },

    async listAssignableMembers(eventId) {
      const rows = await db.eventMember.findMany({
        where: { eventId },
        select: MEMBER_SELECT,
        orderBy: [{ user: { displayName: "asc" } }, { id: "asc" }],
      });
      return rows.map(toMember);
    },

    async findAssignableMember(eventId, memberId) {
      const row = await db.eventMember.findFirst({
        where: { id: memberId, eventId },
        select: MEMBER_SELECT,
      });
      return row ? toMember(row) : null;
    },

    async createTask({ eventId, actorId, input }) {
      const memberRoles = roles() as MemberRole[];
      return db.$transaction(async (tx) => {
        // The assignee must be a member of this event. Checked before a number is used up.
        let assigneeName: string | null = null;
        if (input.assigneeId !== null) {
          const member = await tx.eventMember.findFirst({
            where: { id: input.assigneeId, eventId },
            select: MEMBER_SELECT,
          });
          if (!member) return { ok: false, reason: "assignee-not-found" } as const;
          assigneeName = member.user.displayName;
        }

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
            priority: input.priority,
            assigneeId: input.assigneeId,
          },
          select: { id: true, number: true },
        });
        await writeAudit(tx, {
          eventId,
          actorId,
          action: "task.created",
          entityId: created.id,
          details: {
            reference: formatTaskReference(created.number),
            title: input.title,
            priority: input.priority,
            assignee: assigneeName,
          },
        });
        return { ok: true, id: created.id, number: created.number } as const;
      });
    },

    async updateTask({ eventId, taskId, actorId, version, input, changes }) {
      const guard = allowed(eventId, actorId);
      const where = { id: taskId, updatedAt: version, ...guard };
      return db.$transaction(async (tx) => {
        // A different assignee must be a member of this event (the foreign key checks it again).
        if (input.assigneeId !== null) {
          const member = await tx.eventMember.count({
            where: { id: input.assigneeId, eventId },
          });
          if (member !== 1) return { ok: false, reason: "assignee-not-found" } as const;
        }
        const before = await tx.task.findFirst({ where, select: { number: true } });
        // An explicit list of editable fields: nothing else from the input can reach the row. The
        // conditional update repeats every check, so a change in between updates nothing.
        const { count } = before
          ? await tx.task.updateMany({
              where,
              data: {
                title: input.title,
                description: input.description,
                priority: input.priority,
                assigneeId: input.assigneeId,
              },
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

    async deleteTask({ eventId, taskId, actorId }) {
      const where = { id: taskId, ...allowed(eventId, actorId) };
      return db.$transaction(async (tx) => {
        const task = await tx.task.findFirst({ where, select: { number: true, title: true } });
        const { count } = task ? await tx.task.deleteMany({ where }) : { count: 0 };
        if (!task || count !== 1) return { ok: false, reason: "not-found" } as const;
        await writeAudit(tx, {
          eventId,
          actorId,
          action: "task.deleted",
          entityId: taskId,
          details: { reference: formatTaskReference(task.number), title: task.title },
        });
        return { ok: true, number: task.number, title: task.title } as const;
      });
    },
  };
}