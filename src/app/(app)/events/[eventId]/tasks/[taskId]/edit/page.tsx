// src/app/(app)/events/[eventId]/tasks/[taskId]/edit/page.tsx
// Edit a task (B6-F02; D-094). The task is looked up only inside the authorized event, so another
// event's task is "not found". The loaded updatedAt travels with the form as its edit version
// (D-032).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { requireEventAccess } from "@/modules/events/public";
import { formatTaskReference, getTaskForEdit, TaskForm } from "@/modules/events/tasks/public";

export const metadata: Metadata = { title: "Edit task" };

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ eventId: string; taskId: string }>;
}) {
  const { eventId, taskId } = await params;
  const {
    access: { event },
  } = await requireEventAccess(eventId);
  const basePath = `/events/${event.id}/tasks`;
  const result = await getTaskForEdit(event.id, taskId);
  if (!result.ok) {
    if (result.reason === "forbidden") {
      return (
        <div className="rounded-xl bg-white shadow-xs">
          <UnauthorizedState kind="forbidden" href={basePath} linkLabel="Back to the tasks" />
        </div>
      );
    }
    notFound();
  }
  const { task } = result;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-extrabold">Edit task</h1>
      <TaskForm
        eventId={event.id}
        cancelHref={basePath}
        task={{
          id: task.id,
          reference: formatTaskReference(task.number),
          title: task.title,
          description: task.description,
          version: task.updatedAt.toISOString(),
        }}
      />
    </div>
  );
}