// src/modules/events/tasks/ui/TaskListControls.tsx
// Filters for the task list (B6-F09; D-097). A plain GET form, like the supplier filters (D-083):
// the choices go into the address (?status=done&priority=high), so they work without JavaScript,
// survive refresh and back on any device, and can be shared. The page reads them back through
// parseTaskListQuery and the server does the matching. On a phone status and priority share a row and
// every other field fills its own (a date field is too narrow for half a phone); on wider screens
// they sit in two or three columns. Controls are 44 px tall and nothing scrolls sideways (B6-F16).
import Link from "next/link";
import { fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { TASK_DUE_DATE_RANGE } from "../domain/due-date";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
} from "../domain/task";
import {
  DUE_FILTERS,
  DUE_FILTER_LABEL,
  taskFilterParam,
  type TaskListQuery,
} from "../task-list-query";

type Props = {
  query: TaskListQuery;
  /** Members who have a task in this event: the ID to send and the name to show. */
  assignees: { id: string; label: string }[];
  /** The task list without any filter, for "Clear". */
  listHref: string;
  narrowed: boolean;
};

const labelClass = "text-sm font-semibold";

export function TaskListControls({ query, assignees, listHref, narrowed }: Props) {
  return (
    <form
      method="get"
      action={listHref}
      role="search"
      aria-label="Filter tasks"
      className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-xs sm:p-5"
    >
      <fieldset className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <legend className="sr-only">Filters</legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="task-filter-status" className={labelClass}>
            Status
          </label>
          <select
            id="task-filter-status"
            name="status"
            defaultValue={query.status ? taskFilterParam(query.status) : ""}
            className={fieldControlClass}
          >
            <option value="">Any status</option>
            {TASK_STATUSES.map((status) => (
              <option key={status} value={taskFilterParam(status)}>
                {TASK_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="task-filter-priority" className={labelClass}>
            Priority
          </label>
          <select
            id="task-filter-priority"
            name="priority"
            defaultValue={query.priority ? taskFilterParam(query.priority) : ""}
            className={fieldControlClass}
          >
            <option value="">Any priority</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={taskFilterParam(priority)}>
                {TASK_PRIORITY_LABEL[priority]}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <label htmlFor="task-filter-assignee" className={labelClass}>
            Assigned to
          </label>
          <select
            id="task-filter-assignee"
            name="assignee"
            defaultValue={query.assignee ?? ""}
            className={fieldControlClass}
          >
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <label htmlFor="task-filter-due" className={labelClass}>
            Due date
          </label>
          <select
            id="task-filter-due"
            name="due"
            defaultValue={query.due ?? ""}
            className={fieldControlClass}
          >
            <option value="">Any due date</option>
            {DUE_FILTERS.map((due) => (
              <option key={due} value={due}>
                {DUE_FILTER_LABEL[due]}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <label htmlFor="task-filter-due-from" className={labelClass}>
            Due on or after
          </label>
          <input
            id="task-filter-due-from"
            name="dueFrom"
            type="date"
            min={TASK_DUE_DATE_RANGE.min}
            max={TASK_DUE_DATE_RANGE.max}
            defaultValue={query.dueFrom ?? ""}
            className={fieldControlClass}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <label htmlFor="task-filter-due-to" className={labelClass}>
            Due on or before
          </label>
          <input
            id="task-filter-due-to"
            name="dueTo"
            type="date"
            min={TASK_DUE_DATE_RANGE.min}
            max={TASK_DUE_DATE_RANGE.max}
            defaultValue={query.dueTo ?? ""}
            className={fieldControlClass}
          />
        </div>
      </fieldset>
      <p className="text-xs text-ink-3">
        Dates are Philippine dates. A date range only matches tasks that have a due date.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">Apply</Button>
        {narrowed ? (
          <Button asChild variant="ghost">
            <Link href={listHref}>Clear filters</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}