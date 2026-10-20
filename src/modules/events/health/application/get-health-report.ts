// src/modules/events/health/application/get-health-report.ts
// Event Health for one event (B8-F01 to B8-F12; D-105 to D-107): reads the state, runs the fixed
// checks, the score and the status, and the dashboard summaries. Writes nothing and stores nothing.
// The caller authorizes first (event.view).
import { evaluateHealth, type HealthReport } from "../domain/score";
import { dashboardSummary, type DashboardSummary } from "../domain/summary";
import type { HealthStateReader } from "./build-health-state";

export type HealthOverview = HealthReport & { summary: DashboardSummary[] };

export async function buildHealthOverview(
  reader: HealthStateReader,
  event: { id: string; expectedAttendees: number; capacity: number | null },
): Promise<HealthOverview | null> {
  const inputs = await reader.read(event);
  if (!inputs) return null;
  return {
    ...evaluateHealth(inputs.state),
    summary: dashboardSummary(inputs.state, inputs.accessibilityLabel),
  };
}