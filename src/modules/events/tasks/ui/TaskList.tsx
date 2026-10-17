// src/modules/events/tasks/ui/TaskList.tsx
// The event's tasks as a list of cards (B6-F01, B6-F02; D-094): readable ID, title and description.
// One markup for every width: a single column that fills a phone and reads as rows on a desktop, so
// nothing scrolls sideways. Edit appears only for people who can manage tasks; the server action
// checks the role again. Nothing about assignees, due dates, priority or status yet.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { TaskRecord } from "../application/ports";
import { formatTaskReference } from "../domain/task";

export function TaskList({
  tasks,
  basePath,
  canManage,
}: {
  tasks: TaskRecord[];
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
            </div>
            {canManage ? (
              <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
                <Link href={`${basePath}/${task.id}/edit`}>
                  <span aria-hidden="true">Edit</span>
                  <span className="sr-only">
                    Edit {reference} {task.title}
                  </span>
                </Link>
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}