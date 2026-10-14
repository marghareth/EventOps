-- prisma/migrations/20261013120000_accessibility/migration.sql
-- B3-01 Accessibility Data Model (D-056).
-- 1. Enums, accessibility_requirements and accessibility_resources, in the form the Prisma schema
--    engine generates. Written by hand because the engine could not be downloaded where this was
--    built; CI's `prisma migrate deploy` and `prisma migrate status` check it against the schema.
-- 2. CHECK constraints. Hand-written: Prisma cannot express them and does not diff them, so later
--    migrations keep them.

-- CreateEnum
CREATE TYPE "accessibility_requirement_type" AS ENUM ('MOBILITY_ASSISTANCE', 'ACCESSIBLE_SEATING', 'STEP_FREE_ENTRANCE', 'ACCESSIBLE_RESTROOM', 'SIGN_LANGUAGE', 'CAPTIONING', 'OTHER');

-- CreateEnum
CREATE TYPE "requirement_priority" AS ENUM ('REQUIRED', 'PREFERRED', 'INFORMATIONAL');

-- CreateEnum
CREATE TYPE "accessibility_resource_type" AS ENUM ('ACCESSIBLE_SEATS', 'ACCESSIBLE_ENTRANCE', 'RAMP_OR_ELEVATOR', 'ACCESSIBLE_RESTROOM', 'CAPTIONING', 'SIGN_LANGUAGE');

-- CreateEnum
CREATE TYPE "resource_status" AS ENUM ('NOT_AVAILABLE', 'ARRANGING', 'AVAILABLE');

-- CreateTable
CREATE TABLE "accessibility_requirements" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "attendeeId" UUID NOT NULL,
    "type" "accessibility_requirement_type" NOT NULL,
    "priority" "requirement_priority" NOT NULL,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessibility_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessibility_resources" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "type" "accessibility_resource_type" NOT NULL,
    "status" "resource_status" NOT NULL,
    "quantity" INTEGER,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessibility_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accessibility_requirements_eventId_type_idx" ON "accessibility_requirements"("eventId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "accessibility_requirements_eventId_attendeeId_type_key" ON "accessibility_requirements"("eventId", "attendeeId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "accessibility_requirements_eventId_id_key" ON "accessibility_requirements"("eventId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "accessibility_resources_eventId_type_key" ON "accessibility_resources"("eventId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "accessibility_resources_eventId_id_key" ON "accessibility_resources"("eventId", "id");

-- AddForeignKey
ALTER TABLE "accessibility_requirements" ADD CONSTRAINT "accessibility_requirements_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessibility_requirements" ADD CONSTRAINT "accessibility_requirements_eventId_attendeeId_fkey" FOREIGN KEY ("eventId", "attendeeId") REFERENCES "attendees"("eventId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessibility_resources" ADD CONSTRAINT "accessibility_resources_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Optional text is NULL or has content: an empty note is stored as NULL, never as "".
ALTER TABLE "accessibility_requirements" ADD CONSTRAINT "accessibility_requirements_note_not_blank"
  CHECK ("note" IS NULL OR "note" ~ '\S');

-- "Other" says what is needed (D-057).
ALTER TABLE "accessibility_requirements" ADD CONSTRAINT "accessibility_requirements_other_has_note"
  CHECK ("type" <> 'OTHER' OR "note" IS NOT NULL);

-- Accessible seats have a count of 0 or more; no other resource has one (D-056).
ALTER TABLE "accessibility_resources" ADD CONSTRAINT "accessibility_resources_quantity_rule"
  CHECK (
    ("type" = 'ACCESSIBLE_SEATS' AND "quantity" IS NOT NULL AND "quantity" >= 0)
    OR ("type" <> 'ACCESSIBLE_SEATS' AND "quantity" IS NULL)
  );

ALTER TABLE "accessibility_resources" ADD CONSTRAINT "accessibility_resources_note_not_blank"
  CHECK ("note" IS NULL OR "note" ~ '\S');