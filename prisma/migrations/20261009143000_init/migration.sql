-- prisma/migrations/20261009143000_init/migration.sql
-- B0-08 Database Foundation: users, events, event members and the event reference counter.
-- Generated from prisma/schema.prisma by the Prisma schema engine (diff from empty). The CHECK
-- constraints at the end were added by hand because Prisma cannot express them (D-010).
-- Prisma does not diff CHECK constraints, so later migrations keep them.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('OWNER', 'COORDINATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('DRAFT', 'PLANNING', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "event_members" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "member_role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

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

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint (hand-written, D-010)
ALTER TABLE "events" ADD CONSTRAINT "events_name_not_blank" CHECK ("name" ~ '\S');
ALTER TABLE "events" ADD CONSTRAINT "events_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0);
ALTER TABLE "events" ADD CONSTRAINT "events_expected_attendees_nonneg" CHECK ("expectedAttendees" >= 0);
ALTER TABLE "events" ADD CONSTRAINT "events_ends_not_before_start" CHECK ("endsAt" IS NULL OR "endsAt" >= "startsAt");