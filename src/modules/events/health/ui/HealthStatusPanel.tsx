// src/modules/events/health/ui/HealthStatusPanel.tsx
// The event's health at a glance (B8-F07, B8-F08, B8-F11, B8-F19; D-106): the status in words with an
// icon, the score with what it is made of, and the count of each outcome. A brand-new event with
// nothing to check says so instead of showing a score.
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import { HEALTH_OUTCOMES, HEALTH_OUTCOME_LABEL, type HealthOutcome } from "../domain/health-check";
import { HEALTH_STATUS_LABEL, type HealthReport, type HealthStatus } from "../domain/score";

const STATUS_STYLE: Record<HealthStatus, { icon: StateIconName; className: string }> = {
  AT_RISK: { icon: "error", className: "border-critical-line bg-critical-tint text-critical" },
  NEEDS_ATTENTION: {
    icon: "warning",
    className: "border-warning-line bg-warning-tint text-warning",
  },
  READY: { icon: "success", className: "border-success-line bg-success-tint text-success" },
};

const STATUS_TEXT: Record<HealthStatus, string> = {
  AT_RISK: "At least one check is Critical.",
  NEEDS_ATTENTION: "Nothing is Critical, but some checks need attention.",
  READY: "Every check that could be made passes.",
};

export function HealthStatusPanel({
  report,
}: {
  report: Pick<HealthReport, "status" | "score" | "counts">;
}) {
  if (report.status === null || report.score === null) {
    return (
      <div className="rounded-xl bg-white p-5 shadow-xs">
        <p className="font-semibold">Nothing to check yet</p>
        <p className="mt-1 text-sm text-ink-2">
          Add guests, suppliers, a budget or tasks, and their health will show here.
        </p>
      </div>
    );
  }
  const style = STATUS_STYLE[report.status];
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-xs sm:flex-row sm:items-center">
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3 sm:min-w-56",
          style.className,
        )}
      >
        <StateIcon name={style.icon} />
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase">Status</p>
          <p className="text-h4 font-bold">{HEALTH_STATUS_LABEL[report.status]}</p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p>
          <span className="text-h3 font-extrabold">{report.score.percent}%</span>{" "}
          <span className="text-sm text-ink-2">
            health score: {report.score.passed} of {report.score.evaluated} checks pass
          </span>
        </p>
        <p className="text-sm text-ink-2">{STATUS_TEXT[report.status]}</p>
        <ul aria-label="Checks by outcome" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {HEALTH_OUTCOMES.map((outcome: HealthOutcome) => (
            <li key={outcome}>
              <span className="font-semibold">{report.counts[outcome]}</span>{" "}
              {HEALTH_OUTCOME_LABEL[outcome]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}