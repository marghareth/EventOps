// src/modules/events/impact/schema.ts
// Validation for impact input (B7-F15; D-101 to D-103). Everything from the browser is parsed here
// on the server: the proposed attendance, the assumptions form and the saved-analysis snapshot
// (checked on write and again on read). Amounts use the budget's one peso rule (parsePesos).
import { z } from "zod";
import { parsePesos } from "@/modules/events/budget/public";
import { MAX_ACCESSIBLE_SEATS_PER_100, type ImpactAssumptions } from "./domain/assumptions";
import { MAX_EXPECTED_ATTENDEES } from "./domain/change-event";
import { IMPACT_AREAS, IMPACT_FIX_TARGETS, IMPACT_SEVERITIES } from "./domain/impact-item";

export const IMPACT_MESSAGES = {
  proposedEmpty: "Enter the proposed number of expected attendees.",
  proposedFormat: `Enter a whole number from 0 to ${MAX_EXPECTED_ATTENDEES.toLocaleString("en-US")}.`,
  costFormat: "Enter a peso amount with at most two decimals, for example 350.50, or leave it blank.",
  costTooLarge: "That amount is too large. The most is ₱9,999,999,999.99.",
  ratioFormat: "Enter a number from 0 to 100 with at most two decimals, or leave it blank.",
  categoryNotFound: "Choose a budget category of this event, or none.",
} as const;

/** "220" or "1,200" → 220. Whole numbers only, 0 to 1,000,000. */
export const proposedAttendeesSchema = z.string().transform((raw, ctx) => {
  const text = raw.trim().replace(/,/g, "");
  if (text === "") {
    ctx.addIssue({ code: "custom", message: IMPACT_MESSAGES.proposedEmpty });
    return z.NEVER;
  }
  if (!/^\d{1,7}$/.test(text) || Number(text) > MAX_EXPECTED_ATTENDEES) {
    ctx.addIssue({ code: "custom", message: IMPACT_MESSAGES.proposedFormat });
    return z.NEVER;
  }
  return Number(text);
});

/** Blank → null (not set). Otherwise the exact two-place peso string. */
const optionalPesos = z.string().transform((raw, ctx) => {
  if (raw.trim() === "") return null;
  const parsed = parsePesos(raw);
  if (parsed.ok) return parsed.value;
  ctx.addIssue({
    code: "custom",
    message:
      parsed.reason === "too-large" ? IMPACT_MESSAGES.costTooLarge : IMPACT_MESSAGES.costFormat,
  });
  return z.NEVER;
});

/** Blank → null. Otherwise 0 to 100 with up to two decimals, as a two-place string ("4.50"). */
const optionalRatio = z.string().transform((raw, ctx) => {
  const text = raw.trim();
  if (text === "") return null;
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text);
  const value = match ? `${Number(match[1])}.${(match[2] ?? "").padEnd(2, "0")}` : null;
  // Two-place strings of equal length compare like numbers only up to 99.99, so check 100 apart.
  const tooLarge = value !== null && Number(match?.[1]) >= 100 && value !== MAX_ACCESSIBLE_SEATS_PER_100;
  if (value === null || tooLarge) {
    ctx.addIssue({ code: "custom", message: IMPACT_MESSAGES.ratioFormat });
    return z.NEVER;
  }
  return value;
});

export const ASSUMPTION_FIELDS = [
  "cateringCostPerHead",
  "accessibleSeatsPer100",
  "cateringCategoryId",
] as const;
export type AssumptionField = (typeof ASSUMPTION_FIELDS)[number];

export const assumptionsFormSchema = z.object({
  cateringCostPerHead: optionalPesos,
  accessibleSeatsPer100: optionalRatio,
  cateringCategoryId: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.union([z.literal("").transform(() => null), z.uuid(IMPACT_MESSAGES.categoryNotFound)])),
}) satisfies z.ZodType<ImpactAssumptions, Record<AssumptionField, string>>;

// ───────────────────────── Saved analysis snapshot (D-103) ─────────────────────────

const severity = z.enum(IMPACT_SEVERITIES);
const count = z.number().int().min(0);

const snapshotItem = z
  .object({
    key: z.string().max(200),
    area: z.enum(IMPACT_AREAS),
    severity,
    title: z.string().max(500),
    reason: z.string().max(4000),
    basis: z.enum(["ESTIMATE", "RECORDED"]),
    assumptions: z.array(z.object({ label: z.string(), value: z.string() }).strict()).max(10),
    fix: z.object({ target: z.enum(IMPACT_FIX_TARGETS), label: z.string() }).strict().nullable(),
    references: z.array(z.string().max(20)).max(500),
  })
  .strict();

/**
 * What a saved analysis keeps: the change, the assumptions as they read then (the category by
 * name), and every item as shown. Version 1. Never edited after saving.
 */
export const impactSnapshotSchema = z
  .object({
    version: z.literal(1),
    from: count,
    to: count,
    assumptions: z
      .object({
        cateringCostPerHead: z.string().nullable(),
        accessibleSeatsPer100: z.string().nullable(),
        cateringCategory: z.string().nullable(),
      })
      .strict(),
    overall: severity,
    counts: z.object({ CRITICAL: count, NEEDS_ATTENTION: count, INFO: count, PASSED: count }).strict(),
    items: z.array(snapshotItem).min(1).max(200),
  })
  .strict();

export type ImpactSnapshot = z.infer<typeof impactSnapshotSchema>;