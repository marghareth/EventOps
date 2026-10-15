-- prisma/migrations/20261014090000_suppliers/migration.sql
-- B4-01 Supplier Data Model (D-068), with the B4-02 categories (D-069).
-- 1. supplier_category, events."lastSupplierNumber" and suppliers. In the Prisma schema engine's
--    format (the engine can't be downloaded in the authoring environment; see docs/TESTING.md).
-- 2. CHECK constraints. Hand-written: Prisma cannot express them and does not diff them, so later
--    migrations keep them.

-- CreateEnum
CREATE TYPE "supplier_category" AS ENUM ('VENUE', 'CATERING', 'CAKE_AND_DESSERTS', 'PHOTO_AND_VIDEO', 'SOUND_AND_LIGHTS', 'ENTERTAINMENT', 'FLOWERS_AND_STYLING', 'HAIR_AND_MAKEUP', 'ATTIRE', 'RENTALS', 'TRANSPORT', 'PRINTING_AND_STATIONERY', 'OTHER');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "lastSupplierNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" "supplier_category" NOT NULL,
    "categoryDetail" VARCHAR(60),
    "contactName" VARCHAR(120),
    "email" VARCHAR(254),
    "phone" VARCHAR(32),
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suppliers_eventId_name_idx" ON "suppliers"("eventId", "name");

-- CreateIndex
CREATE INDEX "suppliers_eventId_category_idx" ON "suppliers"("eventId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_eventId_number_key" ON "suppliers"("eventId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_eventId_id_key" ON "suppliers"("eventId", "id");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Supplier numbers are issued from this counter and never reused (D-068).
ALTER TABLE "events" ADD CONSTRAINT "events_last_supplier_number_nonneg"
  CHECK ("lastSupplierNumber" >= 0);

-- Every supplier has a name with at least one non-space character.
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_name_not_blank"
  CHECK ("name" ~ '\S');

-- Readable IDs start at SUP-0001.
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_number_positive"
  CHECK ("number" >= 1);

-- "Other" says what the supplier provides; every other category has no detail (D-069).
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_category_detail"
  CHECK (
    ("category" = 'OTHER' AND "categoryDetail" IS NOT NULL AND "categoryDetail" ~ '\S')
    OR ("category" <> 'OTHER' AND "categoryDetail" IS NULL)
  );

-- Optional text is NULL or has content: an empty value is stored as NULL, never as "".
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_optional_text_not_blank"
  CHECK (
    ("contactName" IS NULL OR "contactName" ~ '\S')
    AND ("email" IS NULL OR "email" ~ '\S')
    AND ("phone" IS NULL OR "phone" ~ '\S')
    AND ("notes" IS NULL OR "notes" ~ '\S')
  );