// src/app/(app)/events/[eventId]/accessibility/[resource]/edit/page.tsx
// Set up or edit one event accessibility resource (B3-05, D-061), for example
// /events/<id>/accessibility/accessible-seats/edit. Checks access itself (D-027). Owners and
// Coordinators get the form: empty when the type is "Not set up", otherwise with the stored values
// and version (D-032) and Remove below. Viewers get "You don't have access" without anything being
// loaded; an unknown resource segment is "not found". The actions authorize again.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnauthorizedState } from "@/components/shared/UnauthorizedState";
import {
  RESOURCE_TYPE_DEFINITIONS,
  RemoveResourceSection,
  ResourceForm,
  deleteResourceAction,
  getResourceForEditing,
  saveResourceAction,
  toResourceFormValues,
} from "@/modules/events/accessibility/public";
import { can, requireEventAccess } from "@/modules/events/public";

export const metadata: Metadata = { title: "Accessibility resource", robots: { index: false } };

type Props = { params: Promise<{ eventId: string; resource: string }> };

export default async function EditResourcePage({ params }: Props) {
  const { eventId, resource: slug } = await params;
  const {
    access: { event },
  } = await requireEventAccess(eventId);
  const backHref = `/events/${event.id}/accessibility`;
  const refused = (
    <div className="rounded-xl bg-white shadow-xs">
      <UnauthorizedState kind="forbidden" href={backHref} linkLabel="Back to accessibility" />
    </div>
  );
  if (!can(event.role, "accessibility.manage")) return refused;

  const result = await getResourceForEditing(event.id, slug);
  if (!result.ok) {
    if (result.reason === "not-found") notFound();
    return refused;
  }
  const { type, resource } = result;
  const definition = RESOURCE_TYPE_DEFINITIONS[type];

  return (
    <div className="max-w-3xl">
      <h1 className="text-h2 font-extrabold">
        {resource ? "Edit" : "Set up"} {definition.label}
      </h1>
      <p className="mt-2 text-ink-2">{definition.description}</p>
      <div className="mt-6 rounded-xl bg-white p-6 shadow-xs sm:p-8">
        <ResourceForm
          action={saveResourceAction.bind(null, event.id, type)}
          type={type}
          cancelHref={backHref}
          saved={resource ? toResourceFormValues(resource) : undefined}
          version={resource ? resource.updatedAt.toISOString() : undefined}
        />
      </div>
      {resource ? (
        <RemoveResourceSection
          action={deleteResourceAction.bind(null, event.id, type)}
          label={definition.label}
        />
      ) : null}
    </div>
  );
}