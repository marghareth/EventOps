-- prisma/migrations/20261020090000_impact/migration.sql
-- B7 Impact Detection (D-101 to D-104). Additive only: one enum, one column on events and two new
-- tables. No existing row is read, changed or deleted.
-- 1. Enum, column, tables, indexes and foreign keys. Written by hand in the Prisma schema engine's
--    format (the engine can't be downloaded in the authoring environment), so `prisma migrate dev`
--    must be run once to confirm there is no drift.
-- 2. CHECK constraints, the trigger that clears a deleted catering category, and the append-only
--    trigger on impact_analyses. Hand-written: Prisma cannot express them and does not diff them.

-- CreateEnum
CREATE TYPE "impact_severity" AS ENUM ('CRITICAL', 'NEEDS_ATTENTION', 'INFO', 'PASSED');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "lastImpactNumber" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "event_impact_assumptions" (
    "eventId" UUID NOT NULL,
    "cateringCostPerHead" DECIMAL(12,2),
    "accessibleSeatsPer100" DECIMAL(5,2),
    "cateringCategoryId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_impact_assumptions_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "impact_analyses" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "fromAttendees" INTEGER NOT NULL,
    "toAttendees" INTEGER NOT NULL,
    "overallSeverity" "impact_severity" NOT NULL,
    "result" JSONB NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impact_analyses_eventId_createdAt_idx" ON "impact_analyses"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "impact_analyses_createdById_idx" ON "impact_analyses"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "impact_analyses_eventId_number_key" ON "impact_analyses"("eventId", "number");

-- AddForeignKey
ALTER TABLE "event_impact_assumptions" ADD CONSTRAINT "event_impact_assumptions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: the catering category must belong to the same event (D-002). MATCH SIMPLE (the
-- default): no check while cateringCategoryId is NULL.
ALTER TABLE "event_impact_assumptions" ADD CONSTRAINT "event_impact_assumptions_eventId_cateringCategoryId_fkey" FOREIGN KEY ("eventId", "cateringCategoryId") REFERENCES "budget_categories"("eventId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_analyses" ADD CONSTRAINT "impact_analyses_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_analyses" ADD CONSTRAINT "impact_analyses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK constraints (hand-written).
ALTER TABLE "events" ADD CONSTRAINT "events_last_impact_number_nonneg"
  CHECK ("lastImpactNumber" >= 0);

ALTER TABLE "event_impact_assumptions" ADD CONSTRAINT "event_impact_assumptions_cost_nonneg"
  CHECK ("cateringCostPerHead" IS NULL OR "cateringCostPerHead" >= 0);

ALTER TABLE "event_impact_assumptions" ADD CONSTRAINT "event_impact_assumptions_ratio_range"
  CHECK ("accessibleSeatsPer100" IS NULL OR ("accessibleSeatsPer100" >= 0 AND "accessibleSeatsPer100" <= 100));

ALTER TABLE "impact_analyses" ADD CONSTRAINT "impact_analyses_number_positive"
  CHECK ("number" >= 1);

ALTER TABLE "impact_analyses" ADD CONSTRAINT "impact_analyses_attendees_range"
  CHECK ("fromAttendees" BETWEEN 0 AND 1000000 AND "toAttendees" BETWEEN 0 AND 1000000);

ALTER TABLE "impact_analyses" ADD CONSTRAINT "impact_analyses_result_object"
  CHECK (jsonb_typeof("result") = 'object');

-- CreateFunction (hand-written, D-102): deleting a budget category clears it from the impact
-- assumptions instead of being blocked by the foreign key. updatedAt moves so an assumptions form
-- opened before the deletion is refused as stale (D-032). BEFORE DELETE, so the foreign key (checked
-- at the end of the statement) sees no row pointing at the category.
CREATE FUNCTION "eventops_clear_impact_catering_category"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "event_impact_assumptions"
  SET "cateringCategoryId" = NULL, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "eventId" = OLD."eventId" AND "cateringCategoryId" = OLD."id";
  RETURN OLD;
END;
$$;

-- CreateTrigger (hand-written, D-102)
CREATE TRIGGER "budget_categories_clear_impact_catering"
BEFORE DELETE ON "budget_categories"
FOR EACH ROW EXECUTE FUNCTION "eventops_clear_impact_catering_category"();

-- Saved analyses are append-only (D-103), like the audit log (D-037). Direct UPDATE and DELETE are
-- rejected. Changes made by a foreign key action are allowed: deleting an event removes its
-- analyses (D-004), and deleting a user sets createdById to NULL. Those run inside the foreign key's
-- own trigger, so the trigger depth is 2 or more; a statement from the application runs at depth 1.
CREATE FUNCTION "eventops_impact_analyses_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'impact_analyses_append_only: saved impact analyses cannot be changed or deleted'
      USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "impact_analyses_append_only"
  BEFORE UPDATE OR DELETE ON "impact_analyses"
  FOR EACH ROW EXECUTE FUNCTION "eventops_impact_analyses_append_only"();