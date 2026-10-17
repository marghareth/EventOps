// src/app/(app)/events/[eventId]/tasks/page.tsx
// The event's tasks (B6-F01 create, B6-F02 edit; D-094). Every member can read them (event.view);
// Owners and Coordinators also get "Add task" and Edit links (tasks.manage). Checks access itself
// (D-027); the read authorizes again, and every action checks once more.
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/EmptyState";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { Button } from "@/components/ui/button";
import { requireEventAccess } from "@/modules/events/public";
import {
  TaskList,
  TaskNotice,
  getEventTasks,
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
const KINDS: readonly TaskNoticeKind[] = ["task-added", "task-saved"];

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
      {tasks.length === 0 ? (
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
        <TaskList tasks={tasks} basePath={basePath} canManage={canManage} />
      )}
    </div>
  );
}