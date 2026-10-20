// src/modules/events/health/ui/HealthStatusPanel.tsx
// The event's health at a glance (B8-F07, B8-F08, B8-F11, B8-F19; D-106), as three bento tiles
// (D-118): the score with the status in words and an icon, the number of Critical checks, and the
// count of each outcome with a bar that only repeats those counts (the words carry the meaning).
// D-119: soft pastel tiles in the violet / lime / ink palette, with decorative shapes behind.
// A brand-new event with nothing to check says so instead of showing a score.
import Link from "next/link";
import { NavIcon } from "@/components/layout/NavIcon";
import { Decor } from "@/components/shared/Decor";
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import { HEALTH_OUTCOMES, HEALTH_OUTCOME_LABEL, type HealthOutcome } from "../domain/health-check";
import { HEALTH_STATUS_LABEL, type HealthReport, type HealthStatus } from "../domain/score";

const STATUS_STYLE: Record<HealthStatus, { icon: StateIconName; className: string }> = {
  AT_RISK: { icon: "error", className: "text-critical" },
  NEEDS_ATTENTION: { icon: "warning", className: "text-warning" },
  READY: { icon: "success", className: "text-success" },
};

const STATUS_TEXT: Record<HealthStatus, string> = {
  AT_RISK: "At least one check is Critical.",
  NEEDS_ATTENTION: "Nothing is Critical, but some checks need attention.",
  READY: "Every check that could be made passes.",
};

/** Bar and legend colors. Decorative: every outcome is also written as a word and a number. */
const OUTCOME_COLOR: Record<HealthOutcome, string> = {
  CRITICAL: "bg-critical",
  NEEDS_ATTENTION: "bg-gold",
  PASSED: "bg-lime",
  NOT_CHECKED: "bg-white/25",
};

export function HealthStatusPanel({
  report,
  criticalHref,
}: {
  report: Pick<HealthReport, "status" | "score" | "counts">;
  /** Where the Critical tile links to (the Critical Alert View). No link when omitted. */
  criticalHref?: string;
}) {
  if (report.status === null || report.score === null) {
    return (
      <div className="rounded-[28px] bg-white p-6 shadow-xs">
        <p className="font-semibold">Nothing to check yet</p>
        <p className="mt-1 text-sm text-ink-2">
          Add guests, suppliers, a budget or tasks, and their health will show here.
        </p>
      </div>
    );
  }
  const style = STATUS_STYLE[report.status];
  const critical = report.counts.CRITICAL;
  const total = HEALTH_OUTCOMES.reduce((sum, outcome) => sum + report.counts[outcome], 0);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Score: soft violet tile. */}
      <div className="relative flex flex-col gap-5 overflow-hidden rounded-[28px] bg-violet-soft p-6 text-ink lg:col-span-5">
        <Decor shape="flower" className="-right-16 -bottom-24 size-60 text-violet/25" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-white text-violet">
            <NavIcon name="pulse" className="size-5" />
          </span>
          <p className="text-sm font-semibold">Health score</p>
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <p className="font-display text-[64px] leading-none font-extrabold tracking-[-0.03em]">
            {report.score.percent}%
          </p>
          <p
            className={cn(
              "inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold shadow-xs",
              style.className,
            )}
          >
            <StateIcon name={style.icon} className="size-4" />
            <span className="sr-only">Status: </span>
            <span>{HEALTH_STATUS_LABEL[report.status]}</span>
          </p>
        </div>
        <div className="relative text-sm text-ink-2">
          <p>
            <span className="font-semibold text-ink">
              {report.score.passed} of {report.score.evaluated} checks pass
            </span>{" "}
            · health score
          </p>
          <p className="mt-0.5">{STATUS_TEXT[report.status]}</p>
        </div>
      </div>

      {/* Critical count: the lime tile. */}
      <div className="relative flex flex-col gap-3 overflow-hidden rounded-[28px] bg-lime p-6 text-ink lg:col-span-3">
        <Decor shape="circle" className="-top-16 -right-16 size-44 text-white/35" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-ink text-lime">
            <StateIcon name="error" className="size-5" />
          </span>
          <p className="text-sm font-semibold">Critical</p>
        </div>
        <p className="relative mt-auto font-display text-[64px] leading-none font-extrabold tracking-[-0.03em]">
          {critical}
        </p>
        <p className="relative text-sm font-medium">
          {critical === 0
            ? "Nothing is Critical right now."
            : `${critical === 1 ? "check needs" : "checks need"} action now`}
        </p>
        {criticalHref && critical > 0 ? (
          <Link
            href={criticalHref}
            className="relative inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-black"
          >
            See critical issues
            <NavIcon name="arrow-up-right" className="size-4" />
          </Link>
        ) : null}
      </div>

      {/* Every outcome, counted: the ink tile. */}
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-[28px] bg-ink p-6 text-white lg:col-span-4">
        <Decor shape="hill" className="inset-x-0 -bottom-6 h-24 w-full text-white/5" />
        <p className="relative text-sm font-semibold text-white/85">Checks by outcome</p>
        <div aria-hidden="true" className="relative flex h-10 gap-1">
          {HEALTH_OUTCOMES.flatMap((outcome) =>
            Array.from({ length: report.counts[outcome] }, (_, index) => (
              <span
                key={`${outcome}-${index}`}
                className={cn("flex-1 rounded-full", OUTCOME_COLOR[outcome])}
              />
            )),
          )}
          {total === 0 ? <span className="flex-1 rounded-full bg-white/25" /> : null}
        </div>
        <ul
          aria-label="Checks by outcome"
          className="relative grid grid-cols-2 gap-x-4 gap-y-2 text-sm"
        >
          {HEALTH_OUTCOMES.map((outcome: HealthOutcome) => (
            <li key={outcome} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn("size-2.5 shrink-0 rounded-full", OUTCOME_COLOR[outcome])}
              />
              <span className="font-display font-extrabold tabular-nums">
                {report.counts[outcome]}
              </span>{" "}
              <span className="text-white/80">{HEALTH_OUTCOME_LABEL[outcome]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}