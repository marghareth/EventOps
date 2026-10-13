// src/modules/events/attendees/ui/RsvpBadge.tsx
// An attendee's RSVP status as a badge (B2-02). Always written as text with an icon, never shown
// by color alone.
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import { RSVP_LABEL, type RsvpStatus } from "../schema";

const STYLE: Record<RsvpStatus, { icon: StateIconName; className: string }> = {
  PENDING: { icon: "info", className: "border-line bg-mist text-ink" },
  CONFIRMED: { icon: "success", className: "border-success-line bg-success-tint text-success" },
  MAYBE: { icon: "warning", className: "border-warning-line bg-warning-tint text-warning" },
  DECLINED: { icon: "error", className: "border-line bg-mist text-ink-2" },
};

export function RsvpBadge({ status }: { status: RsvpStatus }) {
  const style = STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[13px] font-medium whitespace-nowrap",
        style.className,
      )}
    >
      <StateIcon name={style.icon} className="size-3.5" />
      {RSVP_LABEL[status]}
    </span>
  );
}