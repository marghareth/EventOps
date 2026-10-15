// src/modules/events/suppliers/ui/PaymentDueBadge.tsx
// A payment's due status as a badge (B4-15, D-079): Overdue, Due today, Upcoming or Paid. Always
// written as text with an icon, never shown by color alone; the label comes from the canonical
// definitions.
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import { PAYMENT_DUE_STATUS_DEFINITIONS, type PaymentDueStatus } from "../payment-due";

const STYLE: Record<PaymentDueStatus, { icon: StateIconName; className: string }> = {
  OVERDUE: { icon: "error", className: "border-critical-line bg-critical-tint text-critical" },
  DUE_TODAY: { icon: "warning", className: "border-warning-line bg-warning-tint text-warning" },
  UPCOMING: { icon: "info", className: "border-line bg-mist text-ink" },
  PAID: { icon: "success", className: "border-success-line bg-success-tint text-success" },
};

export function PaymentDueBadge({ status }: { status: PaymentDueStatus }) {
  const style = STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[13px] font-medium whitespace-nowrap",
        style.className,
      )}
    >
      <StateIcon name={style.icon} className="size-3.5" />
      {PAYMENT_DUE_STATUS_DEFINITIONS[status].label}
    </span>
  );
}