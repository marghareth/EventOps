// src/modules/events/suppliers/quote-statuses.ts
// The canonical quote statuses and their lifecycle (B4-11, D-076). The form, server validation, the
// status badge, the audit registry's copy and the database enum `quote_status` all follow this
// list; tests keep them equal. Pure: no database, no clock, safe for client components.

/** Where a quote stands. Order is the order shown in forms. */
export const QUOTE_STATUSES = ["PENDING", "ACCEPTED", "DECLINED"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

type QuoteStatusDefinition = {
  /** Short name for badges, the form and the Activity feed. */
  label: string;
  /** What the status means, shown as a hint in the form. */
  description: string;
};

export const QUOTE_STATUS_DEFINITIONS: Record<QuoteStatus, QuoteStatusDefinition> = {
  PENDING: { label: "Pending", description: "Received, no decision yet." },
  ACCEPTED: {
    label: "Accepted",
    description: "You took this quote. Its amount is what's committed to the supplier.",
  },
  DECLINED: { label: "Declined", description: "You didn't take this quote." },
};

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return typeof value === "string" && (QUOTE_STATUSES as readonly string[]).includes(value);
}

export type QuoteStatusCheck =
  | { ok: true }
  /** Another quote of the same supplier is already Accepted; `reference` names it (QUO-0002). */
  | { ok: false; reason: "another-accepted"; reference: string };

/**
 * The lifecycle rule (D-076). Owners and Coordinators may set any status from any status, so a
 * mistake can be corrected; every change is recorded. The one limit: a supplier has at most one
 * Accepted quote, so its committed amount is counted once (D-003, D-075). Accepting while another
 * quote of the supplier is Accepted is refused; nothing changes on its own.
 *
 * `acceptedReference` is the readable ID of the supplier's Accepted quote other than this one, or
 * null when there is none.
 */
export function checkQuoteStatus(
  status: QuoteStatus,
  acceptedReference: string | null,
): QuoteStatusCheck {
  if (status === "ACCEPTED" && acceptedReference !== null) {
    return { ok: false, reason: "another-accepted", reference: acceptedReference };
  }
  return { ok: true };
}

/** The message for a refused status, safe to show beside the status field. */
export function anotherAcceptedMessage(reference: string): string {
  return `${reference} is already accepted for this supplier. Change it to Pending or Declined first.`;
}