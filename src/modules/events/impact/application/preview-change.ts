// src/modules/events/impact/application/preview-change.ts
// Runs an analysis of a proposed expected attendance (B7-F01, B7-F02; D-101) from freshly read
// state. Writes nothing. The caller authorizes first (event.view) and passes the stored event, so
// the "from" value is never the browser's.
import { expectedAttendanceChange } from "../domain/change-event";
import type { EventState } from "../domain/event-state";
import { runImpact, type ImpactResult } from "../domain/run-impact";
import type { ImpactSnapshot } from "../schema";
import { budgetTools } from "./budget-tools";
import type { AssumptionsRecord, EventStateReader, ImpactRepository } from "./ports";

export type ImpactInputs = {
  event: { id: string; expectedAttendees: number; capacity: number | null };
  state: EventState;
  assumptions: AssumptionsRecord;
};

/** Reads everything an analysis needs. null when one of the reads was refused. */
export async function loadImpactInputs(
  deps: { reader: EventStateReader; repository: ImpactRepository },
  event: ImpactInputs["event"],
): Promise<ImpactInputs | null> {
  const [state, assumptions] = await Promise.all([
    deps.reader.read(event),
    deps.repository.getAssumptions(event.id),
  ]);
  return state ? { event, state, assumptions } : null;
}

/** The analysis of `to` against the stored expected attendees. Pure given the inputs. */
export function analyze(inputs: ImpactInputs, to: number): ImpactResult {
  return runImpact(
    inputs.state,
    expectedAttendanceChange(inputs.event.expectedAttendees, to),
    inputs.assumptions,
    budgetTools,
  );
}

/** The snapshot a saved analysis keeps (D-103). Only for an analysis of a real change. */
export function toSnapshot(result: ImpactResult, assumptions: AssumptionsRecord): ImpactSnapshot {
  if (result.noChange || result.overall === null) {
    throw new Error("Only an analysis of a real change can be saved.");
  }
  return {
    version: 1,
    from: result.change.from,
    to: result.change.to,
    assumptions: {
      cateringCostPerHead: assumptions.cateringCostPerHead,
      accessibleSeatsPer100: assumptions.accessibleSeatsPer100,
      cateringCategory: assumptions.cateringCategoryId ? assumptions.cateringCategoryName : null,
    },
    overall: result.overall,
    counts: result.counts,
    items: result.items.map((item) => ({
      ...item,
      assumptions: [...item.assumptions],
      references: [...item.references],
    })),
  };
}