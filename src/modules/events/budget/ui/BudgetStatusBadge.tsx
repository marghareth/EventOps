// src/modules/events/budget/ui/BudgetStatusBadge.tsx
// A budget status as a badge (B5-F08, D-088). Always text with an icon, never color alone. Over
// budget is Critical, within budget is Ready. The label comes from the domain so it is written in
// one place.
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import { BUDGET_STATUS_LABELS, type BudgetStatus } from "../domain/budget-summary";

const STYLE: Record<BudgetStatus, { icon: StateIconName; className: string }> = {
  WITHIN_BUDGET: { icon: "success", className: "border-success-line bg-success-tint text-success" },
  OVER_BUDGET: { icon: "error", className: "border-critical-line bg-critical-tint text-critical" },
};

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  const style = STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[13px] font-medium whitespace-nowrap",
        style.className,
      )}
    >
      <StateIcon name={style.icon} className="size-3.5" />
      {BUDGET_STATUS_LABELS[status]}
    </span>
  );
}