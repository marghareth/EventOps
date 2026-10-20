// src/modules/events/impact/application/ports.ts
// What the impact use cases need from storage and from the other contexts (D-101 to D-103). The
// Prisma repository and the event-state reader implement them; tests use in-memory fakes.
import type { ImpactAssumptions } from "../domain/assumptions";
import type { EventState } from "../domain/event-state";
import type { ImpactSnapshot } from "../schema";

/** The stored assumptions, with the chosen category's name and the edit version. */
export type AssumptionsRecord = ImpactAssumptions & {
  cateringCategoryName: string | null;
  /** The edit version (D-032), or null when nothing was ever saved for the event. */
  updatedAt: Date | null;
};

export type SavedAnalysis = {
  id: string;
  number: number;
  createdAt: Date;
  /** Who saved it, or null if that user was deleted. */
  createdByName: string | null;
  snapshot: ImpactSnapshot;
};

export interface ImpactRepository {
  getAssumptions(eventId: string): Promise<AssumptionsRecord>;
  /**
   * Saves the assumptions if `version` is still current (null: none saved yet). Re-checks the
   * actor's role and that the category belongs to the event, in one transaction with the audit
   * entry. Unchanged values write nothing.
   */
  saveAssumptions(args: {
    eventId: string;
    actorId: string;
    version: Date | null;
    input: ImpactAssumptions;
  }): Promise<
    | { ok: true; changed: boolean }
    | { ok: false; reason: "stale" | "forbidden" | "category-not-found" }
  >;
  /** Newest first. */
  listAnalyses(eventId: string, limit: number): Promise<SavedAnalysis[]>;
  /** Adds one saved analysis with the next IMP number and its audit entry, in one transaction. */
  saveAnalysis(args: {
    eventId: string;
    actorId: string;
    snapshot: ImpactSnapshot;
  }): Promise<{ ok: true; number: number } | { ok: false; reason: "forbidden" }>;
}

/** Reads the event state from each context's own authorized read. null when refused. */
export interface EventStateReader {
  read(event: {
    id: string;
    expectedAttendees: number;
    capacity: number | null;
  }): Promise<EventState | null>;
}