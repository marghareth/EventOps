// src/app/(app)/events/[eventId]/tasks/page.tsx
// The event's tasks (B6-F01 create, B6-F02 edit, B6-F03 delete, B6-F08 list, B6-F09 filters, B6-F10 overdue;
// D-094, D-095, D-097, D-098). Every member can read them (event.view);
// Owners and Coordinators also get "Add task", Edit and Delete (tasks.manage). Checks access itself
// (D-027); the read authorizes again, and every action checks once more.
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { Button } from "@/components/ui/button";
import { requireEventAccess } from "@/modules/events/public";
import {
  TaskList,
  TaskListControls,
  TaskNotice,
  assigneeFilterOptions,
  describeTaskListQuery,
  filterTasks,
  getEventTasks,
  isNarrowed,
  manilaToday,
  parseTaskListQuery,
  isTaskReference,
  formatTaskReference,
  type TaskNoticeKind,
} from "@/modules/events/tasks/public";

export const metadata: Metadata = { title: "Tasks" };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const KINDS: readonly TaskNoticeKind[] = ["task-added", "task-saved", "task-removed"];

export default async function TasksPage({ params, searchParams }: Props) {
  // Membership is checked here too, not only in the event layout (D-027, B1-07).
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const query = await searchParams;
  const result = await getEventTasks(event.id);
  if (!result.ok) {
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState
          kind="forbidden"
          href={`/events/${event.id}`}
          linkLabel="Back to the overview"
        />
      </div>
    );
  }
  const { tasks, canManage } = result;
  const basePath = `/events/${event.id}/tasks`;

  // B6-F09, D-097: filters come from the address and run over the tasks already authorized above,
  // so they cannot reach another event's tasks or widen what this role may read.
  const assignees = assigneeFilterOptions(tasks);
  const filters = parseTaskListQuery(query, new Set(assignees.map((a) => a.id)));
  const narrowed = isNarrowed(filters);
  // One "today" for the whole page, so the Overdue filter and the overdue badges agree. Without it
  // the Overdue filter crashed the page (?overdue=only); fixed in B10 (D-115).
  const today = manilaToday(new Date());
  const shown = filterTasks(tasks, filters, today);

  // After a change: only a known kind and a well-formed reference are used. The title shown comes
  // from the stored record, never from the address.
  const kind = KINDS.find((k) => k === first(query.notice));
  const ref = first(query.ref);
  const notice =
    kind && isTaskReference(ref)
      ? {
          kind,
          reference: ref,
          title: tasks.find((t) => formatTaskReference(t.number) === ref)?.title,
        }
      : null;

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <TaskNotice kind={notice.kind} reference={notice.reference} title={notice.title} />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2 font-extrabold">Tasks</h1>
        {canManage ? (
          <Button asChild>
            <Link href={`${basePath}/new`}>Add task</Link>
          </Button>
        ) : null}
      </div>
      {tasks.length > 0 ? (
        <TaskListControls
          query={filters}
          assignees={assignees}
          listHref={basePath}
          narrowed={narrowed}
        />
      ) : null}
      {tasks.length > 0 && narrowed ? (
        <p className="text-sm text-ink-2" role="status">
          {shown.length} of {tasks.length} {tasks.length === 1 ? "task matches" : "tasks match"}.
        </p>
      ) : null}
      {tasks.length > 0 && shown.length === 0 ? (
        <div className="rounded-xl bg-white shadow-xs">
          <EmptyState
            headingLevel={2}
            title="No tasks match"
            description={`${describeTaskListQuery(filters, (id) => assignees.find((a) => a.id === id)?.label).join(" · ")}. Change the filters, or clear them to see all ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}.`}
            action={
              <Button asChild variant="secondary">
                <Link href={basePath}>Clear filters</Link>
              </Button>
            }
          />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl bg-white shadow-xs">
          <EmptyState
            headingLevel={2}
            title="No tasks yet"
            description={
              canManage
                ? "Add your first task, for example Confirm the florist or Print the programs."
                : "Owners and Coordinators can add tasks to this event."
            }
            action={
              canManage ? (
                <Button asChild>
                  <Link href={`${basePath}/new`}>Add the first task</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <TaskList
          tasks={shown}
          eventId={event.id}
          basePath={basePath}
          canManage={canManage}
          today={today}
        />
      )}
    </div>
  );
}