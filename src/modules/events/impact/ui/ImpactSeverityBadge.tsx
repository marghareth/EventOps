// src/modules/events/impact/ui/ImpactSeverityBadge.tsx
// An impact's severity as a badge (B7-F08, D-101): always an icon and a word, never colour alone.
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import { IMPACT_SEVERITY_LABEL, type ImpactSeverity } from "../domain/impact-item";

const STYLE: Record<ImpactSeverity, { icon: StateIconName; className: string }> = {
  CRITICAL: { icon: "error", className: "border-critical-line bg-critical-tint text-critical" },
  NEEDS_ATTENTION: {
    icon: "warning",
    className: "border-warning-line bg-warning-tint text-warning",
  },
  INFO: { icon: "info", className: "border-info-line bg-info-tint text-info" },
  PASSED: { icon: "success", className: "border-success-line bg-success-tint text-success" },
};

export function ImpactSeverityBadge({
  severity,
  className,
}: {
  severity: ImpactSeverity;
  className?: string;
}) {
  const style = STYLE[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[13px] font-medium whitespace-nowrap",
        style.className,
        className,
      )}
    >
      <StateIcon name={style.icon} className="size-4" />
      {IMPACT_SEVERITY_LABEL[severity]}
    </span>
  );
}