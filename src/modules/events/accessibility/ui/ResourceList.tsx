// src/modules/events/accessibility/ui/ResourceList.tsx
// The event's accessibility resources on the Accessibility page (B3-05, D-061; headed "What the
// event provides" so it reads apart from guests' needs, B3-06): all six types in
// definition order, each with its status in words, the seat count for accessible seats and any
// note. Types with no record show "Not set up". Owners and Coordinators get "Set up" or "Edit".
import Link from "next/link";
import type { ResourceRecord } from "../application/ports";
import { RESOURCE_TYPE_DEFINITIONS, resourceSlug, type ResourceType } from "../domain/resource";
import { ResourceStatusBadge } from "./ResourceStatusBadge";

type Props = {
  /** The event's Accessibility page, for building the edit links. */
  basePath: string;
  resources: { type: ResourceType; resource: ResourceRecord | null }[];
  canManage: boolean;
};

export function ResourceList({ basePath, resources, canManage }: Props) {
  const setUp = resources.filter((r) => r.resource).length;
  return (
    <section
      aria-labelledby="resources-heading"
      className="rounded-xl bg-white p-6 shadow-xs sm:p-8"
    >
      <h2 id="resources-heading" className="text-h4 font-bold">
        What the event provides
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        {setUp === 0
          ? "None of the six resources is set up yet."
          : `${setUp} of ${resources.length} set up.`}{" "}
        Record what the venue and team can provide.
      </p>
      <ul className="mt-4 flex flex-col divide-y divide-line border-y border-line">
        {resources.map(({ type, resource }) => {
          const definition = RESOURCE_TYPE_DEFINITIONS[type];
          return (
            <li key={type} className="flex flex-col gap-2 py-4 sm:flex-row sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-ink">{definition.label}</h3>
                  <ResourceStatusBadge status={resource?.status ?? null} />
                </div>
                <p className="mt-1 text-sm text-ink-2">{definition.description}</p>
                {resource && resource.quantity !== null ? (
                  <p className="mt-2 text-ink">
                    {resource.quantity === 1
                      ? "1 seat"
                      : `${resource.quantity.toLocaleString("en-US")} seats`}
                  </p>
                ) : null}
                {resource?.note ? (
                  <p className="mt-2 break-words whitespace-pre-wrap text-ink">
                    <span className="sr-only">Note: </span>
                    {resource.note}
                  </p>
                ) : null}
              </div>
              {canManage ? (
                <Link
                  href={`${basePath}/${resourceSlug(type)}/edit`}
                  aria-label={`${resource ? "Edit" : "Set up"} ${definition.label}`}
                  className="self-start text-sm font-semibold text-blue underline-offset-2 hover:underline sm:mt-1"
                >
                  {resource ? "Edit" : "Set up"}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!canManage ? (
        <p className="mt-4 text-sm text-ink-2">Owners and Coordinators can change resources.</p>
      ) : null}
    </section>
  );
}