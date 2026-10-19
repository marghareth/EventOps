// src/modules/events/tasks/ui/TaskOverdueBadge.tsx
// "Overdue" on a task that is not Done and past its due date (B6-F10; D-098). A word with an icon,
// never colour alone, in the same style as the supplier payment badge.
import { StateIcon } from "@/components/shared/StateIcon";

export function TaskOverdueBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-critical-line bg-critical-tint px-2.5 py-1 text-[13px] font-medium whitespace-nowrap text-critical">
      <StateIcon name="error" className="size-3.5" />
      Overdue
    </span>
  );
}