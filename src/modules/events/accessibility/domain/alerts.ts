// src/modules/events/accessibility/domain/alerts.ts
// Accessibility alerts (B3-11, D-066): the readiness gaps worth interrupting someone for, derived on
// every read from the status (D-063) and the gaps (D-064). Nothing is stored, sent or dismissed;
// this is not an alert engine. Only gaps that make the event Not ready (critical) or keep it Almost
// ready (warning) become alerts; advice from Preferred needs never does, and a covered need has no
// gap, so it can never raise an alert. Pure and deterministic: no database, clock, AI or permission.
import { GAP_CONSEQUENCE_TEXT, type Gap, type GapKind } from "./gaps";
import { READINESS_STATUS_DEFINITIONS, type ReadinessStatus } from "./readiness-status";
import { RESOURCE_TYPE_DEFINITIONS, type ResourceType } from "./resource";

export type AlertSeverity = "critical" | "warning";

export type AccessibilityAlert = {
  /** "event" for the event-level alert, otherwise the gap's key. */
  key: string;
  severity: AlertSeverity;
  /** A short headline, for example "Captioning is not set up". */
  title: string;
  /** Why: the gap's sentence and what it means for readiness. */
  reason: string;
  /** The gap behind a gap alert; null for the event-level alert. */
  gapKind: GapKind | null;
  /** The resource to fix; null for the event-level alert and for check by hand. */
  resource: ResourceType | null;
  /** The guests the alert is about, in the gap's order, without repeats. */
  attendeeIds: string[];
};

export type AccessibilityAlerts = {
  /** One alert for the whole event while it is Not ready or Almost ready; otherwise null. */
  event: AccessibilityAlert | null;
  /** One alert per alerting gap, most serious first (the gaps' order). */
  gaps: AccessibilityAlert[];
};

const SEVERITY = { "not-ready": "critical", "almost-ready": "warning" } as const;

function titleFor(gap: Gap): string {
  const label = gap.resource ? RESOURCE_TYPE_DEFINITIONS[gap.resource].label : "";
  switch (gap.kind) {
    case "not-set-up":
      return `${label} is not set up`;
    case "not-available":
      return `${label} is not available`;
    case "being-arranged":
      return `${label} is still being arranged`;
    case "not-enough-seats":
      return "Not enough accessible seats";
    case "check-by-hand":
      return "A need to check by hand";
  }
}

const issues = (count: number) =>
  count === 1 ? "1 issue needs attention" : `${count} issues need attention`;

/** The alerts for the event's current readiness (D-066). */
export function deriveAlerts(status: ReadinessStatus, gaps: Gap[]): AccessibilityAlerts {
  const alerts: AccessibilityAlert[] = [];
  for (const gap of gaps) {
    if (gap.consequence === "advice") continue;
    alerts.push({
      key: gap.key,
      severity: SEVERITY[gap.consequence],
      title: titleFor(gap),
      reason: `${gap.summary} ${GAP_CONSEQUENCE_TEXT[gap.consequence]}`,
      gapKind: gap.kind,
      resource: gap.resource,
      attendeeIds: [...new Set(gap.requirements.map((r) => r.attendee.id))],
    });
  }

  const eventSeverity =
    status === "NOT_READY" ? "critical" : status === "ALMOST_READY" ? "warning" : null;
  const event: AccessibilityAlert | null =
    eventSeverity && alerts.length > 0
      ? {
          key: "event",
          severity: eventSeverity,
          title: `Accessibility: ${READINESS_STATUS_DEFINITIONS[status].label}`,
          reason: `${issues(alerts.length)}. ${READINESS_STATUS_DEFINITIONS[status].description}`,
          gapKind: null,
          resource: null,
          attendeeIds: [...new Set(alerts.flatMap((a) => a.attendeeIds))],
        }
      : null;
  return { event, gaps: alerts };
}

/** The gap alerts about one guest (the attendee page). */
export function alertsForGuest(
  alerts: AccessibilityAlerts,
  attendeeId: string,
): AccessibilityAlert[] {
  return alerts.gaps.filter((alert) => alert.attendeeIds.includes(attendeeId));
}