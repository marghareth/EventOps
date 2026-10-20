// src/modules/events/impact/queries.ts
// The Impact page's server-side read (B7-F01, B7-F10 to B7-F14; D-101 to D-103). Every member may
// run a preview (event.view): it reads only what the member can already read and writes nothing.
// The proposed number comes from the address and is validated here; the current number always
// comes from the stored event.
import "server-only";
import { authorizeEvent, can } from "@/modules/events/public";
import { analyze, loadImpactInputs } from "./application/preview-change";
import { impactRepository, impactStateReader } from "./composition";
import type { ImpactResult } from "./domain/run-impact";
import { formatImpactReference } from "./infrastructure/prisma-impact-repository";
import { proposedAttendeesSchema, type ImpactSnapshot } from "./schema";

/** How many saved analyses the page lists, newest first. */
const HISTORY_LIMIT = 20;

const impactPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/impact`;

export type AssumptionsView = {
  cateringCostPerHead: string | null;
  accessibleSeatsPer100: string | null;
  cateringCategoryId: string | null;
  cateringCategoryName: string | null;
  /** The edit version as an ISO string, or "" when nothing was saved yet (D-032). */
  version: string;
};

export type HistoryEntry = {
  reference: string;
  createdAt: Date;
  createdByName: string | null;
  snapshot: ImpactSnapshot;
};

export type ProposalView =
  | { status: "none" }
  | { status: "invalid"; raw: string; message: string }
  | { status: "analyzed"; result: ImpactResult };

export type ImpactWorkspace =
  | {
      ok: true;
      event: { id: string; expectedAttendees: number; capacity: number | null };
      assumptions: AssumptionsView;
      /** The event's budget categories, for the catering category choice. */
      categories: { id: string; name: string }[];
      canEditAssumptions: boolean;
      canRecord: boolean;
      history: HistoryEntry[];
      proposal: ProposalView;
    }
  | { ok: false; reason: "not-found" | "forbidden" | "unavailable" };

export async function getImpactWorkspace(
  eventId: string,
  rawTo: string | undefined,
): Promise<ImpactWorkspace> {
  const auth = await authorizeEvent(eventId, "event.view", impactPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const event = {
    id: auth.event.id,
    expectedAttendees: auth.event.expectedAttendees,
    capacity: auth.event.capacity,
  };
  const repository = impactRepository();
  const [inputs, saved] = await Promise.all([
    loadImpactInputs({ reader: impactStateReader(), repository }, event),
    repository.listAnalyses(event.id, HISTORY_LIMIT),
  ]);
  if (!inputs) return { ok: false, reason: "unavailable" };

  let proposal: ProposalView = { status: "none" };
  if (rawTo !== undefined) {
    const parsed = proposedAttendeesSchema.safeParse(rawTo);
    proposal = parsed.success
      ? { status: "analyzed", result: analyze(inputs, parsed.data) }
      : {
          status: "invalid",
          raw: rawTo.slice(0, 20),
          message: parsed.error.issues[0]?.message ?? "Check the number.",
        };
  }

  const { assumptions } = inputs;
  return {
    ok: true,
    event,
    assumptions: {
      cateringCostPerHead: assumptions.cateringCostPerHead,
      accessibleSeatsPer100: assumptions.accessibleSeatsPer100,
      cateringCategoryId: assumptions.cateringCategoryId,
      cateringCategoryName: assumptions.cateringCategoryName,
      version: assumptions.updatedAt?.toISOString() ?? "",
    },
    categories: inputs.state.budget.map(({ id, name }) => ({ id, name })),
    canEditAssumptions: can(auth.event.role, "impact.assumptions"),
    canRecord: can(auth.event.role, "impact.record"),
    history: saved.map((entry) => ({
      reference: formatImpactReference(entry.number),
      createdAt: entry.createdAt,
      createdByName: entry.createdByName,
      snapshot: entry.snapshot,
    })),
    proposal,
  };
}