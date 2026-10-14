// src/modules/events/accessibility/ui/ReadinessSummary.tsx
// The event's accessibility readiness at a glance (B3-10, D-063): the status in words with an icon
// (never color alone), its plain description, and the counts behind it. The status comes from the
// server's calculation; this component only shows it.
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import {
  READINESS_STATUS_DEFINITIONS,
  type DecidingCounts,
  type ReadinessSeverity,
  type ReadinessStatus,
} from "../domain/readiness-status";

const STYLE: Record<ReadinessSeverity, { icon: StateIconName; box: string }> = {
  success: { icon: "success", box: "border-success-line bg-success-tint text-success" },
  warning: { icon: "warning", box: "border-warning-line bg-warning-tint text-warning" },
  critical: { icon: "error", box: "border-critical-line bg-critical-tint text-critical" },
  info: { icon: "info", box: "border-info-line bg-info-tint text-info" },
};

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export function ReadinessSummary({
  status,
  counts,
}: {
  status: ReadinessStatus;
  counts: DecidingCounts;
}) {
  const definition = READINESS_STATUS_DEFINITIONS[status];
  const style = STYLE[definition.severity];
  const missing = counts.missing + counts.short;
  const facts = [
    missing ? `${missing} missing or short` : null,
    counts.arranging ? `${counts.arranging} being arranged` : null,
    counts["check-by-hand"] ? `${counts["check-by-hand"]} to check by hand` : null,
  ].filter(Boolean);

  return (
    <section
      aria-labelledby="readiness-heading"
      className="rounded-xl bg-white p-6 shadow-xs sm:p-8"
    >
      <h2 id="readiness-heading" className="text-h4 font-bold">
        Accessibility readiness
      </h2>
      <p
        className={cn(
          "mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-lg font-bold",
          style.box,
        )}
      >
        <StateIcon name={style.icon} className="size-5" />
        <span className="sr-only">Status: </span>
        {definition.label}
      </p>
      <p className="mt-3 text-ink">{definition.description}</p>
      {counts.total > 0 ? (
        <p className="mt-2 text-sm text-ink-2">
          {counts.covered} of {counts.total} Required {plural(counts.total, "need", "needs")}{" "}
          covered
          {facts.length ? `: ${facts.join(", ")}.` : "."}
        </p>
      ) : null}
    </section>
  );
}