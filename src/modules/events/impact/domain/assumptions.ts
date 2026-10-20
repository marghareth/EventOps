// src/modules/events/impact/domain/assumptions.ts
// The editable impact assumptions (B7-F12; D-101, D-102). One set per event. Every one is optional
// and has no default: a rule that needs a missing assumption says so instead of guessing.
// Pure: no database, clock or AI.

export type ImpactAssumptions = {
  /** Estimated catering cost per person, as an exact two-place peso string ("350.00"), or null. */
  cateringCostPerHead: string | null;
  /**
   * Accessible seats needed per 100 guests, as a two-place string from "0.00" to "100.00", or
   * null. Used only for the estimate; guests' recorded needs are always checked as well.
   */
  accessibleSeatsPer100: string | null;
  /** The budget category catering is charged to, or null for the whole-event check only. */
  cateringCategoryId: string | null;
};

export const NO_ASSUMPTIONS: ImpactAssumptions = {
  cateringCostPerHead: null,
  accessibleSeatsPer100: null,
  cateringCategoryId: null,
};

export const ASSUMPTION_LABEL = {
  cateringCostPerHead: "Catering cost per head",
  accessibleSeatsPer100: "Accessible seats per 100 guests",
  cateringCategoryId: "Catering budget category",
} as const satisfies Record<keyof ImpactAssumptions, string>;

/** The largest ratio: every guest needs an accessible seat. */
export const MAX_ACCESSIBLE_SEATS_PER_100 = "100.00";

/** "2.50" → 250 (hundredths). Exact: the string already has two places. */
export function ratioHundredths(value: string): number {
  const match = /^(\d{1,3})\.(\d{2})$/.exec(value);
  if (!match) throw new Error(`Not a two-place ratio: ${value}`);
  return Number(match[1]) * 100 + Number(match[2]);
}

/** "2.50" → "2.5", "4.00" → "4": how a ratio reads in a sentence. */
export function formatRatio(value: string): string {
  return value.replace(/\.?0+$/, "") || "0";
}

/**
 * Accessible seats estimated for a number of people (D-102): people × ratio ÷ 100, rounded UP to a
 * whole seat, because a fraction of a seat still needs a seat. Integer arithmetic only.
 */
export function estimateAccessibleSeats(people: number, ratio: string): number {
  const hundredths = ratioHundredths(ratio);
  return Math.ceil((people * hundredths) / 10_000);
}

/** The values that differ between two assumption sets, as before → after pairs (for Activity). */
export function changedAssumptions(
  before: ImpactAssumptions,
  after: ImpactAssumptions,
): (keyof ImpactAssumptions)[] {
  return (Object.keys(ASSUMPTION_LABEL) as (keyof ImpactAssumptions)[]).filter(
    (key) => before[key] !== after[key],
  );
}