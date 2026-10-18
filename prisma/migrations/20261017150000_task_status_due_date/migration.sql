-- prisma/migrations/20261017150000_task_status_due_date/migration.sql
-- B6-F06 Task Status and B6-F07 Task Due Dates (D-096). Additive: one enum, two columns on tasks
-- and one CHECK constraint. Existing tasks get status NOT_STARTED and no due date. Written by hand
-- in the Prisma schema engine's format, so `prisma migrate dev` must be run once to confirm there
-- is no drift. Prisma cannot express the CHECK constraint and does not diff it.

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

-- AlterTable: add status with a temporary default so existing rows get NOT_STARTED, then drop the
-- default: the default for a new task belongs to the domain, not to the column.
ALTER TABLE "tasks" ADD COLUMN     "status" "task_status" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN     "dueDate" DATE;
ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;

-- A due date is a real day from 2000-01-01 to 2100-12-31, as for supplier payments (D-077, D-079).
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_due_date_in_range"
  CHECK ("dueDate" IS NULL OR ("dueDate" >= DATE '2000-01-01' AND "dueDate" <= DATE '2100-12-31'));