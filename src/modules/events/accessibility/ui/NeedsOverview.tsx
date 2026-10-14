// src/modules/events/accessibility/ui/NeedsOverview.tsx
// What guests need (B3-10): the counted needs grouped by type in definition order, with how many
// are Required (decide readiness) and Preferred (advice), and the guests, linked to their pages.
// Needs left out are counted with the reason. Never notes (D-058).
import Link from "next/link";
import type { Coverage, RequirementCoverage } from "../domain/readiness";
import { guestReference } from "../domain/gaps";
import { REQUIREMENT_TYPES, REQUIREMENT_TYPE_DEFINITIONS } from "../domain/requirement-type";

type Props = { coverage: Coverage; attendeesPath: string };

export function NeedsOverview({ coverage, attendeesPath }: Props) {
  const groups = REQUIREMENT_TYPES.map((type) => ({
    type,
    items: coverage.requirements.filter((c) => c.requirement.type === type),
  })).filter((group) => group.items.length > 0);
  const declined = coverage.excluded.filter((e) => e.reason === "declined").length;
  const informational = coverage.excluded.filter((e) => e.reason === "for-information").length;
  const count = (items: RequirementCoverage[], role: RequirementCoverage["role"]) =>
    items.filter((item) => item.role === role).length;

  return (
    <section aria-labelledby="needs-heading" className="rounded-xl bg-white p-6 shadow-xs sm:p-8">
      <h2 id="needs-heading" className="text-h4 font-bold">
        What guests need
      </h2>
      {groups.length === 0 ? (
        <p className="mt-3 text-ink-2">
          No accessibility needs recorded for guests who are coming. Add them from each guest&apos;s
          page on the{" "}
          <Link href={attendeesPath} className="text-blue underline-offset-2 hover:underline">
            guest list
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-line border-y border-line">
          {groups.map(({ type, items }) => (
            <li key={type} className="py-4">
              <h3 className="font-semibold text-ink">{REQUIREMENT_TYPE_DEFINITIONS[type].label}</h3>
              <p className="mt-1 text-sm text-ink-2">
                {count(items, "decides")} Required, {count(items, "advice")} Preferred
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {items.map(({ requirement }) => (
                  <li key={requirement.id}>
                    <Link
                      href={`${attendeesPath}/${requirement.attendee.id}`}
                      className="text-blue underline-offset-2 hover:underline"
                    >
                      {requirement.attendee.name} ({guestReference(requirement.attendee.number)})
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {declined + informational > 0 ? (
        <p className="mt-4 text-sm text-ink-2">
          Not counted: {declined} for guests who declined, {informational} marked For information.
        </p>
      ) : null}
    </section>
  );
}