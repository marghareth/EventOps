-- prisma/migrations/20261015090000_budget/migration.sql
-- B5-F01 Budget Categories and B5-F02 Budget Items (D-084, D-085). Additive only: two new tables and
-- one new column on events. No existing row is read, changed or deleted.
-- 1. events."lastBudgetItemNumber", budget_categories and budget_items. Written by hand in the
--    Prisma schema engine's format (the engine can't be downloaded in the authoring environment;
--    see docs/TESTING.md), so `prisma migrate dev` must be run once to confirm there is no drift.
-- 2. CHECK constraints and the case-insensitive unique index. Hand-written: Prisma cannot express
--    them and does not diff them, so later migrations keep them.

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "lastBudgetItemNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "budget_categories" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "allocationAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_items" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "estimatedAmount" DECIMAL(12,2) NOT NULL,
    "committedAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL,
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budget_categories_eventId_id_key" ON "budget_categories"("eventId", "id");

-- CreateIndex
CREATE INDEX "budget_items_eventId_categoryId_idx" ON "budget_items"("eventId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_items_eventId_number_key" ON "budget_items"("eventId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "budget_items_eventId_id_key" ON "budget_items"("eventId", "id");

-- AddForeignKey
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_eventId_categoryId_fkey" FOREIGN KEY ("eventId", "categoryId") REFERENCES "budget_categories"("eventId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Two categories of one event can't have the same name, ignoring letter case (D-084).
CREATE UNIQUE INDEX "budget_categories_eventId_name_lower_key"
  ON "budget_categories" ("eventId", lower("name"));

-- Budget item numbers are issued from this counter and never reused (D-085).
ALTER TABLE "events" ADD CONSTRAINT "events_last_budget_item_number_nonneg"
  CHECK ("lastBudgetItemNumber" >= 0);

-- A category has a name with at least one non-space character, and an allocation of ₱0.00 or more.
-- DECIMAL(12,2) caps it at ₱9,999,999,999.99.
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_name_not_blank"
  CHECK ("name" ~ '\S');
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_allocation_nonneg"
  CHECK ("allocationAmount" >= 0);

-- Readable IDs start at BUD-0001.
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_number_positive"
  CHECK ("number" >= 1);

-- An item has a name with at least one non-space character; empty notes are stored as NULL.
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_name_not_blank"
  CHECK ("name" ~ '\S');
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_notes_not_blank"
  CHECK ("notes" IS NULL OR "notes" ~ '\S');

-- Estimated, committed and paid are each ₱0.00 or more (D-085).
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_estimated_nonneg"
  CHECK ("estimatedAmount" >= 0);
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_committed_nonneg"
  CHECK ("committedAmount" >= 0);
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_paid_nonneg"
  CHECK ("paidAmount" >= 0);