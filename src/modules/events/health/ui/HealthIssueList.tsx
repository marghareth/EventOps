// src/modules/events/health/ui/HealthIssueList.tsx
// Health issues (B8-F09, B8-F10, B8-F12, B8-F15; D-105): outcome (icon and word), area, what is
// wrong, the rule it breaks, why (the data that triggered it), the records involved and a link to
// the section that fixes it.
// D-119: one rounded card of rows (like a list of people), not a stack of left-bordered cards. Each
// row has the area's icon, the issue, and on the right its outcome and the fix. Each fix link names
// its issue for screen readers (D-117), so a list of "Open Suppliers" links can be told apart.
import Link from "next/link";
import { NavIcon, type NavIconName } from "@/components/layout/NavIcon";
import { cn } from "@/lib/utils";
import { HEALTH_AREA_LABEL, type HealthArea, type HealthCheckResult } from "../domain/health-check";
import { HealthOutcomeBadge } from "./HealthOutcomeBadge";

export function healthFixHref(
  eventId: string,
  target: NonNullable<HealthCheckResult["fix"]>["target"],
) {
  return `/events/${encodeURIComponent(eventId)}/${target}`;
}

/** Decorative: each area has its own icon and soft tile color; the area is also written in words. */
const AREA_STYLE: Record<HealthArea, { icon: NavIconName; tile: string }> = {
  ATTENDEES: { icon: "users", tile: "bg-violet-soft text-ink" },
  SUPPLIERS: { icon: "truck", tile: "bg-lime-soft text-ink" },
  BUDGET: { icon: "wallet", tile: "bg-ink text-lime" },
  ACCESSIBILITY: { icon: "accessibility", tile: "bg-blue-tint text-blue" },
  TASKS: { icon: "tasks", tile: "bg-lime-tint text-ink" },
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
    <ul
      aria-label={label}
      className="flex flex-col gap-1 rounded-[28px] bg-white p-2 shadow-xs sm:p-3"
    >
      {issues.map((issue) => {
        const area = AREA_STYLE[issue.area];
        return (
          <li
            key={issue.id}
            className="flex flex-col gap-3 rounded-2xl p-3 transition-colors duration-150 hover:bg-mist sm:flex-row sm:items-start sm:gap-4"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                area.tile,
              )}
            >
              <NavIcon name={area.icon} className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Heading className="font-sans text-base font-semibold tracking-normal wrap-break-word">
                {issue.summary}
              </Heading>
              <p className="text-sm wrap-break-word text-ink-2">{issue.reason}</p>
              <p className="text-xs text-ink-3">
                <span>Check: {issue.label}</span>
                <span aria-hidden="true"> · </span>
                <span>{HEALTH_AREA_LABEL[issue.area]}</span>
              </p>
              {issue.references.length > 0 ? (
                <p className="mt-1 flex min-w-0 flex-wrap gap-1.5 text-xs text-ink-2">
                  <span className="sr-only">Records involved: </span>
                  {issue.references.map((reference) => (
                    <span key={reference} className="rounded-full bg-paper px-2 py-0.5 font-mono">
                      {reference}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
              <HealthOutcomeBadge outcome={issue.outcome} />
              {issue.fix ? (
                <Link
                  href={healthFixHref(eventId, issue.fix.target)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-black"
                >
                  {issue.fix.label}
                  <span className="sr-only">: {issue.summary}</span>
                  <NavIcon name="arrow-up-right" className="size-4" />
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}