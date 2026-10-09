-- prisma/migrations/20261009141000_init/migration.sql
-- Initial EventOps schema. Generated from prisma/schema.prisma by the Prisma schema engine
-- (diff from empty), then the CHECK constraints at the end were added by hand because Prisma
-- cannot express them. Prisma does not diff CHECK constraints, so later migrations keep them.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('OWNER', 'COORDINATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('DRAFT', 'PLANNING', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "rsvp_status" AS ENUM ('INVITED', 'CONFIRMED', 'DECLINED', 'MAYBE');

-- CreateEnum
CREATE TYPE "requirement_type" AS ENUM ('MOBILITY_ASSISTANCE', 'ACCESSIBLE_SEATING', 'ACCESSIBLE_ENTRANCE', 'ACCESSIBLE_RESTROOM', 'SIGN_LANGUAGE', 'CAPTIONING', 'DIETARY', 'OTHER');

-- CreateEnum
CREATE TYPE "supplier_category" AS ENUM ('VENUE', 'CATERING', 'TRANSPORT', 'PHOTO_VIDEO', 'DECOR_FLORALS', 'ENTERTAINMENT', 'ATTIRE_BEAUTY', 'PRINTING', 'OTHER');

-- CreateEnum
CREATE TYPE "quote_status" AS ENUM ('REQUESTED', 'RECEIVED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "budget_category" AS ENUM ('VENUE', 'CATERING', 'TRANSPORT', 'PHOTO_VIDEO', 'DECOR_FLORALS', 'ENTERTAINMENT', 'ATTIRE_BEAUTY', 'PRINTING', 'OTHER');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "event_area" AS ENUM ('ATTENDEES', 'SEATING', 'ACCESSIBILITY', 'BUDGET', 'CATERING', 'SUPPLIERS', 'TRANSPORT', 'VOLUNTEERS', 'TASKS', 'TIMELINE');

-- CreateEnum
CREATE TYPE "severity" AS ENUM ('CRITICAL', 'NEEDS_ATTENTION', 'INFO', 'PASSED');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('UPLOADED', 'EXTRACTING', 'READY_FOR_REVIEW', 'CONFIRMED', 'DISCARDED', 'FAILED');

-- CreateEnum
CREATE TYPE "extraction_source" AS ENUM ('MODEL', 'SMART_IMPORT');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "venue" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "capacity" INTEGER,
    "expectedAttendees" INTEGER NOT NULL DEFAULT 0,
    "status" "event_status" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nextAttendeeNumber" INTEGER NOT NULL DEFAULT 1,
    "nextSupplierNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_reference_counters" (
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_reference_counters_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "event_assumptions" (
    "eventId" UUID NOT NULL,
    "costPerHead" DECIMAL(12,2) NOT NULL,
    "accessibleSeatRatio" DECIMAL(5,4) NOT NULL,
    "vehicleCapacity" INTEGER NOT NULL,
    "attendeesPerVolunteer" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_assumptions_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "event_members" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "member_role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendees" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "rsvpStatus" "rsvp_status" NOT NULL DEFAULT 'INVITED',
    "category" TEXT,
    "plusOnes" INTEGER NOT NULL DEFAULT 0,
    "dietaryNeeds" TEXT,
    "notes" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessibility_requirements" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "attendeeId" UUID,
    "volunteerId" UUID,
    "type" "requirement_type" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accessibility_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accessibility_resources" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "type" "requirement_type" NOT NULL,
    "available" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessibility_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" "supplier_category" NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "quoteAmount" DECIMAL(12,2),
    "quoteStatus" "quote_status" NOT NULL DEFAULT 'REQUESTED',
    "depositAmount" DECIMAL(12,2),
    "dueDate" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_allocations" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "category" "budget_category" NOT NULL,
    "allocated" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_items" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "supplierId" UUID,
    "category" "budget_category" NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedAmount" DECIMAL(12,2) NOT NULL,
    "committedAmount" DECIMAL(12,2),
    "paidAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeMemberId" UUID,
    "dueDate" TIMESTAMP(3),
    "priority" "task_priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "task_status" NOT NULL DEFAULT 'TODO',
    "relatedSupplierId" UUID,
    "relatedArea" "event_area",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_roles" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL,

    CONSTRAINT "volunteer_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteers" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "roleId" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "shiftStart" TIMESTAMP(3),
    "shiftEnd" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volunteers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_items" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_events" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "changedById" UUID NOT NULL,
    "changeType" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_items" (
    "id" UUID NOT NULL,
    "impactEventId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "ruleId" TEXT NOT NULL,
    "area" "event_area" NOT NULL,
    "severity" "severity" NOT NULL,
    "message" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "isEstimate" BOOLEAN NOT NULL,
    "assumptionsUsed" JSONB NOT NULL,
    "linkedRoute" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_sessions" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "status" "import_status" NOT NULL DEFAULT 'UPLOADED',
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "extractionSource" "extraction_source",
    "extracted" JSONB,
    "validationReport" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "events_reference_key" ON "events"("reference");

-- CreateIndex
CREATE INDEX "events_createdById_idx" ON "events"("createdById");

-- CreateIndex
CREATE INDEX "events_status_startsAt_idx" ON "events"("status", "startsAt");

-- CreateIndex
CREATE INDEX "event_members_userId_idx" ON "event_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_members_eventId_userId_key" ON "event_members"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_members_eventId_id_key" ON "event_members"("eventId", "id");

-- CreateIndex
CREATE INDEX "attendees_eventId_rsvpStatus_idx" ON "attendees"("eventId", "rsvpStatus");

-- CreateIndex
CREATE INDEX "attendees_eventId_name_idx" ON "attendees"("eventId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_eventId_number_key" ON "attendees"("eventId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "attendees_eventId_id_key" ON "attendees"("eventId", "id");

-- CreateIndex
CREATE INDEX "accessibility_requirements_eventId_type_idx" ON "accessibility_requirements"("eventId", "type");

-- CreateIndex
CREATE INDEX "accessibility_requirements_eventId_attendeeId_idx" ON "accessibility_requirements"("eventId", "attendeeId");

-- CreateIndex
CREATE INDEX "accessibility_requirements_eventId_volunteerId_idx" ON "accessibility_requirements"("eventId", "volunteerId");

-- CreateIndex
CREATE UNIQUE INDEX "accessibility_resources_eventId_type_key" ON "accessibility_resources"("eventId", "type");

-- CreateIndex
CREATE INDEX "suppliers_eventId_category_idx" ON "suppliers"("eventId", "category");

-- CreateIndex
CREATE INDEX "suppliers_eventId_quoteStatus_idx" ON "suppliers"("eventId", "quoteStatus");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_eventId_number_key" ON "suppliers"("eventId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_eventId_id_key" ON "suppliers"("eventId", "id");

-- CreateIndex
CREATE INDEX "supplier_payments_eventId_supplierId_idx" ON "supplier_payments"("eventId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_allocations_eventId_category_key" ON "budget_allocations"("eventId", "category");

-- CreateIndex
CREATE INDEX "budget_items_eventId_category_idx" ON "budget_items"("eventId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "budget_items_eventId_supplierId_key" ON "budget_items"("eventId", "supplierId");

-- CreateIndex
CREATE INDEX "tasks_eventId_status_dueDate_idx" ON "tasks"("eventId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "tasks_eventId_relatedArea_idx" ON "tasks"("eventId", "relatedArea");

-- CreateIndex
CREATE INDEX "tasks_eventId_assigneeMemberId_idx" ON "tasks"("eventId", "assigneeMemberId");

-- CreateIndex
CREATE INDEX "tasks_eventId_relatedSupplierId_idx" ON "tasks"("eventId", "relatedSupplierId");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_roles_eventId_name_key" ON "volunteer_roles"("eventId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_roles_eventId_id_key" ON "volunteer_roles"("eventId", "id");

-- CreateIndex
CREATE INDEX "volunteers_eventId_roleId_idx" ON "volunteers"("eventId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "volunteers_eventId_id_key" ON "volunteers"("eventId", "id");

-- CreateIndex
CREATE INDEX "timeline_items_eventId_startsAt_idx" ON "timeline_items"("eventId", "startsAt");

-- CreateIndex
CREATE INDEX "impact_events_eventId_createdAt_idx" ON "impact_events"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "impact_events_eventId_id_key" ON "impact_events"("eventId", "id");

-- CreateIndex
CREATE INDEX "impact_items_eventId_impactEventId_idx" ON "impact_items"("eventId", "impactEventId");

-- CreateIndex
CREATE INDEX "impact_items_eventId_severity_idx" ON "impact_items"("eventId", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "import_sessions_storagePath_key" ON "import_sessions"("storagePath");

-- CreateIndex
CREATE INDEX "import_sessions_eventId_status_idx" ON "import_sessions"("eventId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_eventId_createdAt_idx" ON "audit_logs"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_eventId_entityType_entityId_idx" ON "audit_logs"("eventId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "event_assumptions" ADD CONSTRAINT "event_assumptions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessibility_requirements" ADD CONSTRAINT "accessibility_requirements_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessibility_requirements" ADD CONSTRAINT "accessibility_requirements_eventId_attendeeId_fkey" FOREIGN KEY ("eventId", "attendeeId") REFERENCES "attendees"("eventId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessibility_requirements" ADD CONSTRAINT "accessibility_requirements_eventId_volunteerId_fkey" FOREIGN KEY ("eventId", "volunteerId") REFERENCES "volunteers"("eventId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessibility_resources" ADD CONSTRAINT "accessibility_resources_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_eventId_supplierId_fkey" FOREIGN KEY ("eventId", "supplierId") REFERENCES "suppliers"("eventId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_eventId_supplierId_fkey" FOREIGN KEY ("eventId", "supplierId") REFERENCES "suppliers"("eventId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_eventId_assigneeMemberId_fkey" FOREIGN KEY ("eventId", "assigneeMemberId") REFERENCES "event_members"("eventId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_eventId_relatedSupplierId_fkey" FOREIGN KEY ("eventId", "relatedSupplierId") REFERENCES "suppliers"("eventId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_roles" ADD CONSTRAINT "volunteer_roles_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_eventId_roleId_fkey" FOREIGN KEY ("eventId", "roleId") REFERENCES "volunteer_roles"("eventId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_items" ADD CONSTRAINT "timeline_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_events" ADD CONSTRAINT "impact_events_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_items" ADD CONSTRAINT "impact_items_eventId_impactEventId_fkey" FOREIGN KEY ("eventId", "impactEventId") REFERENCES "impact_events"("eventId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint (hand-written)
-- An accessibility requirement belongs to exactly one attendee or one volunteer.
ALTER TABLE "accessibility_requirements" ADD CONSTRAINT "accessibility_requirements_one_owner" CHECK (num_nonnulls("attendeeId", "volunteerId") = 1);

-- AddCheckConstraint (hand-written). See docs/DECISIONS.md, D-003.
-- A budget line linked to a supplier takes its committed and paid money from that supplier and
-- stores none itself. An unlinked line must store both amounts.
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_amount_source" CHECK (
  ("supplierId" IS NULL AND "committedAmount" IS NOT NULL AND "paidAmount" IS NOT NULL)
  OR ("supplierId" IS NOT NULL AND "committedAmount" IS NULL AND "paidAmount" IS NULL)
);