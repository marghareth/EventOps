// src/modules/events/tasks/ui/TaskGroups.tsx
// The task list grouped by status (D-118): Not started, In progress, then Done, each a collapsible
// section with its count, holding the same TaskList rows in the order the page gives them. Uses the
// native <details> element, so it opens and closes from the keyboard with no script. Empty groups
// are left out. The status is said by each heading in words, with an icon; the tint is decoration.
import { StateIcon, type StateIconName } from "@/components/shared/StateIcon";
import { NavIcon } from "@/components/layout/NavIcon";
import { cn } from "@/lib/utils";
import type { TaskRecord } from "../application/ports";
import { TASK_STATUSES, TASK_STATUS_LABEL, type TaskStatus } from "../domain/task";
import { TaskList } from "./TaskList";

const GROUP_STYLE: Record<TaskStatus, { icon: StateIconName; header: string; iconColor: string }> =
  {
    NOT_STARTED: { icon: "info", header: "bg-blue-tint", iconColor: "text-blue" },
    IN_PROGRESS: { icon: "loading", header: "bg-lime-tint", iconColor: "text-ink" },
    DONE: { icon: "success", header: "bg-success-tint", iconColor: "text-success" },
  };

export function TaskGroups({
  tasks,
  eventId,
  basePath,
  canManage,
  today,
}: {
  tasks: TaskRecord[];
  eventId: string;
  basePath: string;
  canManage: boolean;
  /** The Philippine day, "YYYY-MM-DD", worked out once per request. */
  today: string;
}) {
  const groups = TASK_STATUSES.map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status),
  })).filter((group) => group.tasks.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ status, tasks: inGroup }) => {
        const style = GROUP_STYLE[status];
        const headingId = `task-group-${status.toLowerCase()}`;
        return (
          <section key={status} aria-labelledby={headingId}>
            <details open className="group/task-group">
              <summary
                className={cn(
                  "flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-2.5 [&::-webkit-details-marker]:hidden",
                  style.header,
                )}
              >
                <NavIcon
                  name="chevron-down"
                  className="size-4 text-ink-2 transition-transform duration-150 group-not-open/task-group:-rotate-90"
                />
                <StateIcon name={style.icon} className={cn("size-4.5", style.iconColor)} />
                <h2 id={headingId} className="font-sans text-base font-semibold tracking-normal">
                  {TASK_STATUS_LABEL[status]}
                </h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-2 tabular-nums">
                  {inGroup.length}
                  <span className="sr-only"> {inGroup.length === 1 ? "task" : "tasks"}</span>
                </span>
              </summary>
              <div className="mt-2">
                <TaskList
                  tasks={inGroup}
                  eventId={eventId}
                  basePath={basePath}
                  canManage={canManage}
                  today={today}
                  label={`${TASK_STATUS_LABEL[status]} tasks`}
                  headingLevel={3}
                  showStatus={false}
                />
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}