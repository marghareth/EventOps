-- prisma/migrations/20261014150000_supplier_payments/migration.sql
-- B4-12 Supplier Payment Data Model (D-077): status tracking only, no payment processing.
-- 1. payment_kind, payment_record_status, events."lastPaymentNumber" and supplier_payments. In the
--    Prisma schema engine's format (the engine can't be downloaded in the authoring environment;
--    see docs/TESTING.md).
-- 2. CHECK constraints. Hand-written: Prisma cannot express them and does not diff them, so later
--    migrations keep them.

-- CreateEnum
CREATE TYPE "payment_kind" AS ENUM ('DEPOSIT', 'PAYMENT');

-- CreateEnum
CREATE TYPE "payment_record_status" AS ENUM ('UNPAID', 'PAID');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "lastPaymentNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" "payment_kind" NOT NULL,
    "description" VARCHAR(120),
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "payment_record_status" NOT NULL DEFAULT 'UNPAID',
    "paidOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_payments_eventId_supplierId_dueDate_idx" ON "supplier_payments"("eventId", "supplierId", "dueDate");

-- CreateIndex
CREATE INDEX "supplier_payments_eventId_status_dueDate_idx" ON "supplier_payments"("eventId", "status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_eventId_number_key" ON "supplier_payments"("eventId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_eventId_id_key" ON "supplier_payments"("eventId", "id");

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_eventId_supplierId_fkey" FOREIGN KEY ("eventId", "supplierId") REFERENCES "suppliers"("eventId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Payment numbers are issued from this counter and never reused (D-077).
ALTER TABLE "events" ADD CONSTRAINT "events_last_payment_number_nonneg"
  CHECK ("lastPaymentNumber" >= 0);

-- A payment is an amount owed: more than ₱0.00 (D-075, D-077).
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_amount_positive"
  CHECK ("amount" > 0);

-- Readable IDs start at PAY-0001.
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_number_positive"
  CHECK ("number" >= 1);

-- The optional description is NULL or has content: an empty value is stored as NULL.
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_description_not_blank"
  CHECK ("description" IS NULL OR "description" ~ '\S');

-- A paid payment has the day it was paid; an unpaid one has none (D-077).
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_paid_on_rule"
  CHECK (
    ("status" = 'PAID' AND "paidOn" IS NOT NULL)
    OR ("status" = 'UNPAID' AND "paidOn" IS NULL)
  );

-- Dates are real calendar dates within the supported range (D-079). "Not in the future" for paidOn
-- depends on today's date, so the application checks it (a CHECK must not depend on the clock).
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_dates_in_range"
  CHECK (
    "dueDate" BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'
    AND ("paidOn" IS NULL OR "paidOn" BETWEEN DATE '2000-01-01' AND DATE '2100-12-31')
  );