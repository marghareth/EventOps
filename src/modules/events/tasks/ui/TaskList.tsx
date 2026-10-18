// src/modules/events/tasks/ui/TaskList.tsx
// The event's tasks as a list of cards (B6-F01 to B6-F07; D-094 to D-096): readable ID, title,
// description, status, priority, due date and who it is assigned to. One markup for every width: a single column that
// fills a phone and reads as rows on a desktop, so nothing scrolls sideways. Edit and Delete appear
// only for people who can manage tasks; the server actions check the role again. Priority is shown
// as a word on a tinted badge, never colour alone. The due date is shown as written, in Philippine
// time; whether a task is late is a separate, later feature.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { deleteTaskAction } from "../actions";
import type { TaskRecord } from "../application/ports";
import { formatCalendarDate } from "../domain/due-date";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  formatTaskReference,
  type TaskPriority,
} from "../domain/task";
import { TaskDeleteButton } from "./TaskDeleteButton";

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  HIGH: "border-critical-line bg-critical-tint text-critical",
  MEDIUM: "border-info-line bg-info-tint text-info",
  LOW: "border-line bg-mist text-ink",
};

export function TaskList({
  tasks,
  eventId,
  basePath,
  canManage,
}: {
  tasks: TaskRecord[];
  eventId: string;
  basePath: string;
  canManage: boolean;
}) {
  return (
    <ul aria-label="Tasks" className="flex flex-col gap-3">
      {tasks.map((task) => {
        const reference = formatTaskReference(task.number);
        return (
          <li
            key={task.id}
            className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-xs sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-mono text-sm text-ink-2">{reference}</p>
              <h2 className="mt-0.5 text-h4 font-bold wrap-break-word">{task.title}</h2>
              {task.description ? (
                <p className="mt-1 text-sm wrap-break-word whitespace-pre-line text-ink-2">
                  {task.description}
                </p>
              ) : null}
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-2">
                <span
                  className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[13px] leading-tight font-medium ${PRIORITY_STYLE[task.priority]}`}
                >
                  {TASK_PRIORITY_LABEL[task.priority]} priority
                </span>
                <span className="inline-flex items-center rounded-lg border border-line bg-white px-2.5 py-1 text-[13px] leading-tight font-medium text-ink">
                  <span className="sr-only">Status: </span>
                  {TASK_STATUS_LABEL[task.status]}
                </span>
                <span>
                  {task.dueDate ? (
                    <>
                      Due{" "}
                      <span className="font-semibold text-ink">
                        {formatCalendarDate(task.dueDate)}
                      </span>
                    </>
                  ) : (
                    "No due date"
                  )}
                </span>
                <span>
                  {task.assignee ? (
                    <>
                      Assigned to{" "}
                      <span className="font-semibold text-ink">{task.assignee.name}</span>
                    </>
                  ) : (
                    "Unassigned"
                  )}
                </span>
              </p>
            </div>
            {canManage ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
                  <Link href={`${basePath}/${task.id}/edit`}>
                    <span aria-hidden="true">Edit</span>
                    <span className="sr-only">
                      Edit {reference} {task.title}
                    </span>
                  </Link>
                </Button>
                <TaskDeleteButton
                  action={deleteTaskAction.bind(null, eventId, task.id)}
                  reference={reference}
                  title={task.title}
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}