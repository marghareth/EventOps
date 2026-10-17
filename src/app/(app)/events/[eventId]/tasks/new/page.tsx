// src/app/(app)/events/[eventId]/tasks/new/page.tsx
// Add a task (B6-F01; D-094). Owners and Coordinators only. Membership is checked here (D-027) and
// the role by authorizeEvent; the server action checks once more.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import { authorizeEvent, requireEventAccess } from "@/modules/events/public";
import { TaskForm } from "@/modules/events/tasks/public";

export const metadata: Metadata = { title: "Add task" };

export default async function NewTaskPage({ params }: { params: Promise<{ eventId: string }> }) {
  const {
    access: { event },
  } = await requireEventAccess((await params).eventId);
  const basePath = `/events/${event.id}/tasks`;
  const auth = await authorizeEvent(event.id, "tasks.manage", basePath);
  if (!auth.ok) {
    if (auth.reason === "not-found") notFound();
    return (
      <div className="rounded-xl bg-white shadow-xs">
        <UnauthorizedState kind="forbidden" href={basePath} linkLabel="Back to the tasks" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-extrabold">Add task</h1>
      <TaskForm eventId={event.id} cancelHref={basePath} />
    </div>
  );
}