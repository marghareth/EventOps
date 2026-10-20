// src/modules/events/impact/actions.ts
// Impact server actions (B7-F11, B7-F12, B7-F14, B7-F15; D-102, D-103). Server actions are public
// HTTP endpoints, so each one authorizes first with authorizeEvent (D-036) and validates every input
// on the server. Saving an analysis never trusts a result from the browser: the analysis is run
// again here from the stored data, and refused if the event or the assumptions changed since the
// user saw it. Neither action changes the event itself.
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsFrom } from "@/lib/auth-rules";
import { authorizeEvent } from "@/modules/events/public";
import { analyze, loadImpactInputs, toSnapshot } from "./application/preview-change";
import { impactRepository, impactStateReader } from "./composition";
import {
  ASSUMPTION_FORM_FIELDS,
  IMPACT_ACTION_MESSAGES as MESSAGES,
  type AssumptionFormField,
  type AssumptionsFormState,
  type SaveAnalysisState,
} from "./form-state";
import { formatImpactReference } from "./infrastructure/prisma-impact-repository";
import { assumptionsFormSchema, proposedAttendeesSchema } from "./schema";

const versionSchema = z.union([z.literal("").transform(() => null), z.iso.datetime()]);
const fromSchema = z
  .string()
  .regex(/^\d{1,7}$/)
  .transform(Number);

const impactPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/impact`;

const text = (formData: FormData, field: string) => {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
};

/** The proposal to keep on the page after a save, if it is a valid number. */
const keepProposal = (formData: FormData) => {
  const parsed = proposedAttendeesSchema.safeParse(text(formData, "to"));
  return parsed.success ? `&to=${parsed.data}` : "";
};

/** Saves the event's impact assumptions (B7-F12). Owners and Coordinators (impact.assumptions). */
export async function saveAssumptionsAction(
  eventId: string,
  _previous: AssumptionsFormState,
  formData: FormData,
): Promise<AssumptionsFormState> {
  const auth = await authorizeEvent(eventId, "impact.assumptions", impactPath(eventId));
  const values = {} as Record<AssumptionFormField, string>;
  for (const field of ASSUMPTION_FORM_FIELDS) values[field] = text(formData, field);
  if (!auth.ok) {
    const message =
      auth.reason === "forbidden" ? MESSAGES.assumptionsForbidden : MESSAGES.eventNotFound;
    return { status: "error", message, values };
  }

  const parsed = assumptionsFormSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }
  const version = versionSchema.safeParse(text(formData, "version"));
  if (!version.success) return { status: "error", message: MESSAGES.assumptionsStale, values };

  let changed: boolean;
  try {
    const result = await impactRepository().saveAssumptions({
      eventId: auth.event.id,
      actorId: auth.user.id,
      version: version.data === null ? null : new Date(version.data),
      input: parsed.data,
    });
    if (!result.ok) {
      if (result.reason === "category-not-found") {
        return {
          status: "error",
          fieldErrors: { cateringCategoryId: MESSAGES.categoryNotFound },
          values,
        };
      }
      const message =
        result.reason === "stale" ? MESSAGES.assumptionsStale : MESSAGES.assumptionsForbidden;
      return { status: "error", message, values };
    }
    changed = result.changed;
  } catch {
    // Database unreachable or a constraint failed: nothing was saved (one transaction).
    return { status: "error", message: MESSAGES.saveFailed, values };
  }
  revalidatePath(impactPath(auth.event.id));
  redirect(
    `${impactPath(auth.event.id)}?notice=${changed ? "assumptions-saved" : "assumptions-unchanged"}${keepProposal(formData)}`,
  );
}

/**
 * Saves the analysis of `to` to the history (B7-F11). Owners and Coordinators (impact.record).
 * `from` and `version` are what the user saw; if either is no longer current the save is refused,
 * so the history never holds an analysis nobody looked at.
 */
export async function saveAnalysisAction(
  eventId: string,
  _previous: SaveAnalysisState,
  formData: FormData,
): Promise<SaveAnalysisState> {
  const auth = await authorizeEvent(eventId, "impact.record", impactPath(eventId));
  if (!auth.ok) {
    const message = auth.reason === "forbidden" ? MESSAGES.recordForbidden : MESSAGES.eventNotFound;
    return { status: "error", message };
  }
  const to = proposedAttendeesSchema.safeParse(text(formData, "to"));
  const from = fromSchema.safeParse(text(formData, "from"));
  const version = versionSchema.safeParse(text(formData, "version"));
  if (!to.success || !from.success || !version.success) {
    return { status: "error", message: MESSAGES.analysisStale };
  }
  if (from.data !== auth.event.expectedAttendees) {
    return { status: "error", message: MESSAGES.analysisStale };
  }

  let number: number;
  try {
    const event = {
      id: auth.event.id,
      expectedAttendees: auth.event.expectedAttendees,
      capacity: auth.event.capacity,
    };
    const repository = impactRepository();
    const inputs = await loadImpactInputs({ reader: impactStateReader(), repository }, event);
    if (!inputs) return { status: "error", message: MESSAGES.unavailable };
    if ((inputs.assumptions.updatedAt?.toISOString() ?? null) !== version.data) {
      return { status: "error", message: MESSAGES.analysisStale };
    }
    const result = analyze(inputs, to.data);
    if (result.noChange) return { status: "error", message: MESSAGES.noChange };
    const saved = await repository.saveAnalysis({
      eventId: auth.event.id,
      actorId: auth.user.id,
      snapshot: toSnapshot(result, inputs.assumptions),
    });
    // The role changed after the check above: refused in the database.
    if (!saved.ok) return { status: "error", message: MESSAGES.recordForbidden };
    number = saved.number;
  } catch {
    return { status: "error", message: MESSAGES.saveFailed };
  }
  revalidatePath(impactPath(auth.event.id));
  redirect(
    `${impactPath(auth.event.id)}?to=${to.data}&notice=analysis-saved&ref=${formatImpactReference(number)}`,
  );
}