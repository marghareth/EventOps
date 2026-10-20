// src/modules/events/health/ui/HealthIssueList.tsx
// Health issues as cards (B8-F09, B8-F10, B8-F12, B8-F15; D-105): outcome (icon and word), area, what
// is wrong, the rule it breaks, why (the data that triggered it), the records involved and a link to
// the section that fixes it. One column at every width, so nothing scrolls sideways.
// B10-F17 (D-117): a coloured edge by outcome for scanning (the badge's word still carries the
// meaning), and each fix link names its issue for screen readers, so a list of "Open Suppliers"
// links can be told apart.
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HEALTH_AREA_LABEL, type HealthCheckResult } from "../domain/health-check";
import { HealthOutcomeBadge } from "./HealthOutcomeBadge";

export function healthFixHref(
  eventId: string,
  target: NonNullable<HealthCheckResult["fix"]>["target"],
) {
  return `/events/${encodeURIComponent(eventId)}/${target}`;
}

const EDGE: Record<HealthCheckResult["outcome"], string> = {
  CRITICAL: "border-critical",
  NEEDS_ATTENTION: "border-warning",
  PASSED: "border-success",
  NOT_CHECKED: "border-line",
};

export function HealthIssueList({
  issues,
  eventId,
  label,
  headingLevel = 3,
}: {
  issues: readonly HealthCheckResult[];
  eventId: string;
  label: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {issues.map((issue) => (
        <li
          key={issue.id}
          className={cn(
            "flex flex-col gap-2 rounded-xl border-l-4 bg-white p-5 shadow-xs",
            EDGE[issue.outcome],
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <HealthOutcomeBadge outcome={issue.outcome} />
            <span className="text-sm font-semibold text-ink-2">
              {HEALTH_AREA_LABEL[issue.area]}
            </span>
          </div>
          <Heading className="text-h4 font-bold wrap-break-word">{issue.summary}</Heading>
          <p className="text-sm text-ink-3">Check: {issue.label}</p>
          <p className="text-sm wrap-break-word text-ink-2">{issue.reason}</p>
          {issue.references.length > 0 ? (
            <p className="text-sm wrap-break-word text-ink-2">
              <span className="sr-only">Records involved: </span>
              {issue.references.map((reference) => (
                <span key={reference} className="mr-2 font-mono">
                  {reference}
                </span>
              ))}
            </p>
          ) : null}
          {issue.fix ? (
            <p>
              <Link
                href={healthFixHref(eventId, issue.fix.target)}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-blue underline underline-offset-2"
              >
                {issue.fix.label}
                <span className="sr-only">: {issue.summary}</span>
              </Link>
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}