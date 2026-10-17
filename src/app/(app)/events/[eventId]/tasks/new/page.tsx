// src/app/(app)/events/[eventId]/tasks/new/page.tsx
// Add a task (B6-F01, B6-F04, B6-F05; D-094, D-095). Owners and Coordinators only. Membership is
// checked here (D-027) and the role by the assignee read (tasks.manage); the server action checks
// once more, and accepts only an assignee who is a member of this event.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { requireEventAccess } from "@/modules/events/public";
import { TaskForm, getAssigneeOptions } from "@/modules/events/tasks/public";

export const metadata: Metadata = { title: "Add task" };

export default async function NewTaskPage({ params }: { params: Promise<{ eventId: string }> }) {
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const basePath = `/events/${event.id}/tasks`;
  const options = await getAssigneeOptions(event.id);
  if (!options.ok) {
    if (options.reason === "not-found") notFound();
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState kind="forbidden" href={basePath} linkLabel="Back to the tasks" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-extrabold">Add task</h1>
      <TaskForm eventId={event.id} cancelHref={basePath} assignees={options.assignees} />
    </div>
  );
}