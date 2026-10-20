// src/modules/events/impact/form-state.ts
// What the impact server actions return to the forms, and every message they show (B7-F12,
// B7-F11, B7-F15, B7-F17). Kept apart from actions.ts because a "use server" file may only export
// async functions, and free of server imports so client components can use it.

export const ASSUMPTION_FORM_FIELDS = [
  "cateringCostPerHead",
  "accessibleSeatsPer100",
  "cateringCategoryId",
] as const;
export type AssumptionFormField = (typeof ASSUMPTION_FORM_FIELDS)[number];

export type AssumptionsFormState =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Partial<Record<AssumptionFormField, string>>;
      values: Record<AssumptionFormField, string>;
    };

export type SaveAnalysisState = { status: "idle" } | { status: "error"; message: string };

export const IMPACT_ACTION_MESSAGES = {
  eventNotFound: "We couldn't find this event.",
  assumptionsForbidden: "Only Owners and Coordinators can change the assumptions.",
  recordForbidden: "Only Owners and Coordinators can save analyses to the history.",
  assumptionsStale:
    "Someone else changed the assumptions while you were editing. Reload the page to see the latest values.",
  categoryNotFound: "Choose a budget category of this event, or none.",
  saveFailed: "We couldn't save. Nothing was changed. Try again in a moment.",
  analysisStale:
    "The expected attendees or the assumptions changed since this analysis ran. Run it again, then save.",
  noChange: "There's nothing to save: the proposed number is the same as the current one.",
  unavailable: "We couldn't read all of this event's data, so nothing was saved. Try again.",
} as const;

/** The notices the Impact page shows after a change. */
export const IMPACT_NOTICES = [
  "assumptions-saved",
  "assumptions-unchanged",
  "analysis-saved",
] as const;
export type ImpactNoticeKind = (typeof IMPACT_NOTICES)[number];