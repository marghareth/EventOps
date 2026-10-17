-- prisma/migrations/20261017120000_task_priority_assignee/migration.sql
-- B6-F04 Task Assignment and B6-F05 Task Priority (D-095). Additive: one enum and two columns on
-- tasks, one index, one composite foreign key and one trigger. Existing tasks get priority MEDIUM
-- and no assignee. Written by hand in the Prisma schema engine's format, so `prisma migrate dev`
-- must be run once to confirm there is no drift (the trigger is not diffed by Prisma).
-- B6-F03 Task Deletion needs no schema change: a task has no dependent rows yet.

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterTable: add priority with a temporary default so existing rows get MEDIUM, then drop the
-- default: the default for a new task belongs to the domain (PROJECT_RULES, schema ground rules).
ALTER TABLE "tasks" ADD COLUMN     "priority" "task_priority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "assigneeId" UUID;
ALTER TABLE "tasks" ALTER COLUMN "priority" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "tasks_eventId_assigneeId_idx" ON "tasks"("eventId", "assigneeId");

-- AddForeignKey: the assignee must be a member of the same event (D-002). MATCH SIMPLE (the
-- default): no check while assigneeId is NULL.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_eventId_assigneeId_fkey" FOREIGN KEY ("eventId", "assigneeId") REFERENCES "event_members"("eventId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- CreateFunction (hand-written, D-095): when a member is removed (directly, with their user, or with
-- the event), their tasks become unassigned instead of blocking the removal. updatedAt moves so an
-- edit form opened before the removal is refused as stale (D-032). BEFORE DELETE, so the foreign key
-- (checked at the end of the statement) sees no task pointing at the member.
CREATE FUNCTION "eventops_unassign_tasks_of_member"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "tasks"
  SET "assigneeId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "eventId" = OLD."eventId" AND "assigneeId" = OLD."id";
  RETURN OLD;
END;
$$;

-- CreateTrigger (hand-written, D-095)
CREATE TRIGGER "event_members_unassign_tasks"
BEFORE DELETE ON "event_members"
FOR EACH ROW EXECUTE FUNCTION "eventops_unassign_tasks_of_member"();