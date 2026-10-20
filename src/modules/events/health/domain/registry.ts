// src/modules/events/health/domain/registry.ts
// The fixed list of Event Health checks, in order (B8-F01; D-105): 13 checks across attendees,
// suppliers, budget, accessibility and tasks. Each counts once in the score.
import type { HealthCheckResult } from "./health-check";
import type { HealthState } from "./health-state";
import { accessibilityChecks } from "./checks/accessibility";
import { attendeeChecks } from "./checks/attendee-data";
import { budgetChecks } from "./checks/budget";
import { supplierChecks } from "./checks/supplier-confirmations";
import { taskChecks } from "./checks/tasks";

export const HEALTH_CHECK_GROUPS: readonly ((state: HealthState) => HealthCheckResult[])[] = [
  attendeeChecks,
  supplierChecks,
  budgetChecks,
  accessibilityChecks,
  taskChecks,
];

export const HEALTH_CHECK_COUNT = 13;