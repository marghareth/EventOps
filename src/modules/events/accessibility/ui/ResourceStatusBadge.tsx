// src/modules/events/accessibility/ui/ResourceStatusBadge.tsx
// A resource's status as a badge (B3-05, D-057): always text with an icon, never color alone.
// "Not set up" is shown when the event has no record for the type.
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { cn } from "@/lib/utils";
import {
  NOT_SET_UP_LABEL,
  RESOURCE_STATUS_DEFINITIONS,
  type ResourceStatus,
} from "../domain/resource";

const STYLE: Record<ResourceStatus | "NOT_SET_UP", { icon: StateIconName; className: string }> = {
  AVAILABLE: { icon: "success", className: "border-success-line bg-success-tint text-success" },
  ARRANGING: { icon: "warning", className: "border-warning-line bg-warning-tint text-warning" },
  NOT_AVAILABLE: {
    icon: "error",
    className: "border-critical-line bg-critical-tint text-critical",
  },
  NOT_SET_UP: { icon: "info", className: "border-line bg-mist text-ink" },
};

export function ResourceStatusBadge({ status }: { status: ResourceStatus | null }) {
  const style = STYLE[status ?? "NOT_SET_UP"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[13px] font-medium whitespace-nowrap",
        style.className,
      )}
    >
      <StateIcon name={style.icon} className="size-3.5" />
      <span className="sr-only">Status: </span>
      {status ? RESOURCE_STATUS_DEFINITIONS[status].label : NOT_SET_UP_LABEL}
    </span>
  );
}