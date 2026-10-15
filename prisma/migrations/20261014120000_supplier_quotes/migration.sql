-- prisma/migrations/20261014120000_supplier_quotes/migration.sql
-- B4-08 Quote Data Model (D-075), with the B4-11 quote statuses (D-076).
-- 1. quote_status, events."lastQuoteNumber" and supplier_quotes. In the Prisma schema engine's
--    format (the engine can't be downloaded in the authoring environment; see docs/TESTING.md).
-- 2. CHECK constraints. Hand-written: Prisma cannot express them and does not diff them, so later
--    migrations keep them.

-- CreateEnum
CREATE TYPE "quote_status" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "lastQuoteNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "supplier_quotes" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "description" VARCHAR(120),
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "quote_status" NOT NULL DEFAULT 'PENDING',
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_quotes_eventId_supplierId_status_idx" ON "supplier_quotes"("eventId", "supplierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quotes_eventId_number_key" ON "supplier_quotes"("eventId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quotes_eventId_id_key" ON "supplier_quotes"("eventId", "id");

-- AddForeignKey
ALTER TABLE "supplier_quotes" ADD CONSTRAINT "supplier_quotes_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotes" ADD CONSTRAINT "supplier_quotes_eventId_supplierId_fkey" FOREIGN KEY ("eventId", "supplierId") REFERENCES "suppliers"("eventId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Quote numbers are issued from this counter and never reused (D-075).
ALTER TABLE "events" ADD CONSTRAINT "events_last_quote_number_nonneg"
  CHECK ("lastQuoteNumber" >= 0);

-- A quote is a price: more than ₱0.00 (D-075). DECIMAL(12,2) caps it at ₱9,999,999,999.99.
ALTER TABLE "supplier_quotes" ADD CONSTRAINT "supplier_quotes_amount_positive"
  CHECK ("amount" > 0);

-- Readable IDs start at QUO-0001.
ALTER TABLE "supplier_quotes" ADD CONSTRAINT "supplier_quotes_number_positive"
  CHECK ("number" >= 1);

-- The optional description is NULL or has content: an empty value is stored as NULL.
ALTER TABLE "supplier_quotes" ADD CONSTRAINT "supplier_quotes_description_not_blank"
  CHECK ("description" IS NULL OR "description" ~ '\S');