// src/modules/events/ui/EventBadges.tsx
// Event status and member role badges. Both are written as text, never shown by color alone.
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import { EVENT_STATUS_LABEL, MEMBER_ROLE_LABEL, type EventListItem } from "../list";

const STATUS_STYLE: Record<EventListItem["status"], { icon: StateIconName; className: string }> = {
  DRAFT: { icon: "info", className: "border-line bg-mist text-ink" },
  PLANNING: { icon: "info", className: "border-info-line bg-info-tint text-info" },
  LIVE: { icon: "success", className: "border-success-line bg-success-tint text-success" },
  COMPLETED: { icon: "success", className: "border-line bg-mist text-ink-2" },
  CANCELLED: { icon: "error", className: "border-critical-line bg-critical-tint text-critical" },
};

const badge =
  "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[13px] font-medium";

export function EventStatusBadge({ status }: { status: EventListItem["status"] }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={cn(badge, style.className)}>
      <StateIcon name={style.icon} className="size-3.5" />
      {EVENT_STATUS_LABEL[status]}
    </span>
  );
}

export function RoleBadge({ role }: { role: EventListItem["role"] }) {
  return (
    <span className={cn(badge, "border-info-line bg-blue-tint text-blue-dark")}>
      {MEMBER_ROLE_LABEL[role]}
    </span>
  );
}