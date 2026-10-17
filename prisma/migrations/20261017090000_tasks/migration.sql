-- prisma/migrations/20261017090000_tasks/migration.sql
-- B6-F01 Task Creation and B6-F02 Task Editing (D-094). Additive only: one new table and one new
-- column on events. No existing row is read, changed or deleted.
-- 1. events."lastTaskNumber" and tasks. Written by hand in the Prisma schema engine's format (the
--    engine can't be downloaded in the authoring environment), so `prisma migrate dev` must be run
--    once to confirm there is no drift.
-- 2. CHECK constraints. Hand-written: Prisma cannot express them and does not diff them, so later
--    migrations keep them.

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "lastTaskNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tasks_eventId_number_key" ON "tasks"("eventId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_eventId_id_key" ON "tasks"("eventId", "id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Task numbers are issued from this counter and never reused (D-094).
ALTER TABLE "events" ADD CONSTRAINT "events_last_task_number_nonneg"
  CHECK ("lastTaskNumber" >= 0);

-- Readable IDs start at TSK-0001.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_number_positive"
  CHECK ("number" >= 1);

-- A task has a title with at least one non-space character; a description, if present, has one too.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_title_not_blank"
  CHECK ("title" ~ '\S');
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_description_not_blank"
  CHECK ("description" IS NULL OR "description" ~ '\S');