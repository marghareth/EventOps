// src/modules/events/health/application/build-health-state.ts
// The port Event Health reads through (B8-F01, B8-F16; D-105). The infrastructure reader builds the
// state from each context's own authorized read; tests use a fake.
import type { HealthState } from "../domain/health-state";

export type HealthInputs = {
  state: HealthState;
  /** Batch 3's own label for the readiness status, for example "Almost ready". */
  accessibilityLabel: string;
};

export interface HealthStateReader {
  /** null when one of the reads was refused. */
  read(event: {
    id: string;
    expectedAttendees: number;
    capacity: number | null;
  }): Promise<HealthInputs | null>;
}