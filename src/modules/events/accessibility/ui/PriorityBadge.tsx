// src/modules/events/accessibility/ui/PriorityBadge.tsx
// A requirement's priority as a badge (B3-04, D-057). Always written as text, never shown by color
// alone; the label comes from the canonical definitions.
import { cn } from "@/lib/utils";
import {
  REQUIREMENT_PRIORITY_DEFINITIONS,
  type RequirementPriority,
} from "../domain/requirement-type";

const STYLE: Record<RequirementPriority, string> = {
  REQUIRED: "border-info-line bg-blue-tint text-blue-dark",
  PREFERRED: "border-line bg-mist text-ink",
  INFORMATIONAL: "border-line bg-white text-ink-2",
};

export function PriorityBadge({ priority }: { priority: RequirementPriority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2.5 py-1 text-[13px] font-medium whitespace-nowrap",
        STYLE[priority],
      )}
    >
      <span className="sr-only">Priority: </span>
      {REQUIREMENT_PRIORITY_DEFINITIONS[priority].label}
    </span>
  );
}