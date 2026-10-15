// src/modules/events/suppliers/ui/PaymentStatusBadge.tsx
// A supplier's payment status as a badge (B4-13, D-078). Always written as text with an icon, never
// shown by color alone; the label comes from the canonical definitions.
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import { SUPPLIER_PAYMENT_STATUS_DEFINITIONS, type SupplierPaymentStatus } from "../payment-status";

const STYLE: Record<SupplierPaymentStatus, { icon: StateIconName; className: string }> = {
  NO_ACCEPTED_QUOTE: { icon: "info", className: "border-line bg-mist text-ink-2" },
  UNPAID: { icon: "info", className: "border-line bg-mist text-ink" },
  PARTIALLY_PAID: {
    icon: "warning",
    className: "border-warning-line bg-warning-tint text-warning",
  },
  PAID: { icon: "success", className: "border-success-line bg-success-tint text-success" },
};

export function PaymentStatusBadge({ status }: { status: SupplierPaymentStatus }) {
  const style = STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[13px] font-medium whitespace-nowrap",
        style.className,
      )}
    >
      <StateIcon name={style.icon} className="size-3.5" />
      {SUPPLIER_PAYMENT_STATUS_DEFINITIONS[status].label}
    </span>
  );
}