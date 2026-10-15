// src/modules/events/suppliers/ui/QuoteStatusBadge.tsx
// A quote's status as a badge (B4-11, D-076). Always written as text with an icon, never shown by
// color alone; the label comes from the canonical definitions.
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import { QUOTE_STATUS_DEFINITIONS, type QuoteStatus } from "../quote-statuses";

const STYLE: Record<QuoteStatus, { icon: StateIconName; className: string }> = {
  PENDING: { icon: "info", className: "border-line bg-mist text-ink" },
  ACCEPTED: { icon: "success", className: "border-success-line bg-success-tint text-success" },
  DECLINED: { icon: "error", className: "border-line bg-mist text-ink-2" },
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const style = STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[13px] font-medium whitespace-nowrap",
        style.className,
      )}
    >
      <StateIcon name={style.icon} className="size-3.5" />
      {QUOTE_STATUS_DEFINITIONS[status].label}
    </span>
  );
}