// src/modules/events/health/ui/HealthCheckList.tsx
// Every health check, grouped by area (B8-F01, B8-F10; D-105): what is checked, the outcome (icon and
// word), the result and why. Passed and Not checked are shown too, so the score can be traced.
import Link from "next/link";
import { HEALTH_AREAS, HEALTH_AREA_LABEL, type HealthCheckResult } from "../domain/health-check";
import { HealthOutcomeBadge } from "./HealthOutcomeBadge";
import { healthFixHref } from "./HealthIssueList";

export function HealthCheckList({
  checks,
  eventId,
}: {
  checks: readonly HealthCheckResult[];
  eventId: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      {HEALTH_AREAS.map((area) => {
        const inArea = checks.filter((c) => c.area === area);
        if (inArea.length === 0) return null;
        const headingId = `health-area-${area.toLowerCase()}`;
        return (
          <section key={area} aria-labelledby={headingId} className="flex flex-col gap-3">
            <h3 id={headingId} className="text-h4 font-bold">
              {HEALTH_AREA_LABEL[area]}
            </h3>
            <ul className="flex flex-col divide-y divide-line rounded-xl bg-white shadow-xs">
              {inArea.map((check) => (
                <li key={check.id} className="flex flex-col gap-1.5 p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <p className="font-semibold wrap-break-word">{check.label}</p>
                    <HealthOutcomeBadge outcome={check.outcome} className="self-start" />
                  </div>
                  <p className="text-sm font-medium">{check.summary}</p>
                  <p className="text-sm wrap-break-word text-ink-2">{check.reason}</p>
                  {check.fix && check.outcome !== "PASSED" ? (
                    <p>
                      <Link
                        href={healthFixHref(eventId, check.fix.target)}
                        className="inline-flex min-h-11 items-center text-sm font-semibold text-blue underline underline-offset-2"
                      >
                        {check.fix.label}
                      </Link>
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}