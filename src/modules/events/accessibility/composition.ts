// src/modules/events/accessibility/composition.ts
// Wires the accessibility use cases to storage (D-001): PostgreSQL, or the dev-only in-memory sample
// store while demo sign-in runs without a database (D-041).
import "server-only";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import type { AccessibilityRepository } from "./application/ports";
import { prismaAccessibilityRepository } from "./infrastructure/prisma-accessibility-repository";
import { sampleAccessibilityRepository } from "./infrastructure/sample-accessibility-repository";

export function accessibilityRepository(): AccessibilityRepository {
  return isSampleDataMode()
    ? sampleAccessibilityRepository()
    : prismaAccessibilityRepository(getDb());
}