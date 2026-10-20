// src/modules/events/health/ui/HealthOutcomeBadge.tsx
// A health check's outcome as a badge (B8-F08, B8-F09; D-106): always an icon and a word, never colour
// alone. The same look as the Impact severity badge (B7), so both read as one scale.
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import { HEALTH_OUTCOME_LABEL, type HealthOutcome } from "../domain/health-check";

const STYLE: Record<HealthOutcome, { icon: StateIconName; className: string }> = {
  CRITICAL: { icon: "error", className: "border-critical-line bg-critical-tint text-critical" },
  NEEDS_ATTENTION: {
    icon: "warning",
    className: "border-warning-line bg-warning-tint text-warning",
  },
  PASSED: { icon: "success", className: "border-success-line bg-success-tint text-success" },
  NOT_CHECKED: { icon: "info", className: "border-line bg-mist text-ink-2" },
};

export function HealthOutcomeBadge({
  outcome,
  className,
}: {
  outcome: HealthOutcome;
  className?: string;
}) {
  const style = STYLE[outcome];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[13px] font-medium whitespace-nowrap",
        style.className,
        className,
      )}
    >
      <StateIcon name={style.icon} className="size-4" />
      {HEALTH_OUTCOME_LABEL[outcome]}
    </span>
  );
}