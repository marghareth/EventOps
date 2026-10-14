// src/modules/events/accessibility/ui/AccessibilitySection.tsx
// The Accessibility section of the attendee details page (B3-04, D-051). Lists the attendee's needs
// with their priority in words; notes only when the server loaded them (accessibility.private,
// D-058); add and edit links only for roles that may manage accessibility. Has empty and error
// states; the page's own loading screen covers loading. Text is rendered as text, never HTML.
import Link from "next/link";
import { DetailSection } from "@/components/shared/DetailSection";
import { StateIcon } from "@/components/shared/StateIcon";
import { Button } from "@/components/ui/button";
import type { RequirementRecord } from "../application/ports";
import { REQUIREMENT_TYPES, REQUIREMENT_TYPE_DEFINITIONS } from "../domain/requirement-type";
import { PriorityBadge } from "./PriorityBadge";

type Props = {
  /** The attendee's details page, for building the add and edit links. */
  attendeeHref: string;
  attendeeName: string;
  data:
    | { status: "ok"; requirements: RequirementRecord[]; showNotes: boolean; canManage: boolean }
    /** The read failed: the rest of the page still works. */
    | { status: "error" };
};

export function AccessibilitySection({ attendeeHref, attendeeName, data }: Props) {
  if (data.status === "error") {
    return (
      <DetailSection id="attendee-accessibility" title="Accessibility">
        <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-critical">
          <StateIcon name="error" className="mt-0.5 size-4" />
          <span>We couldn&apos;t load accessibility needs. Reload the page to try again.</span>
        </p>
      </DetailSection>
    );
  }
  const { requirements, showNotes, canManage } = data;
  const canAddMore = requirements.length < REQUIREMENT_TYPES.length;
  const addLink =
    canManage && canAddMore ? (
      <Button asChild variant="secondary" size="sm">
        <Link href={`${attendeeHref}/accessibility/new`}>Add accessibility need</Link>
      </Button>
    ) : null;

  return (
    <DetailSection id="attendee-accessibility" title="Accessibility">
      {requirements.length === 0 ? (
        <div className="mt-3 flex flex-col items-start gap-4">
          <p className="text-ink-2">No accessibility needs recorded for {attendeeName}.</p>
          {addLink}
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-2">
            {requirements.length === 1 ? "1 need" : `${requirements.length} needs`} recorded.
          </p>
          <ul className="mt-4 flex flex-col divide-y divide-line border-y border-line">
            {requirements.map((requirement) => {
              const label = REQUIREMENT_TYPE_DEFINITIONS[requirement.type].label;
              return (
                <li key={requirement.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-ink">{label}</h3>
                      <PriorityBadge priority={requirement.priority} />
                    </div>
                    {showNotes ? (
                      requirement.note ? (
                        <p className="mt-2 wrap-break-word whitespace-pre-wrap text-ink">
                          <span className="sr-only">Note: </span>
                          {requirement.note}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-ink-2">No note.</p>
                      )
                    ) : null}
                  </div>
                  {canManage ? (
                    <Link
                      href={`${attendeeHref}/accessibility/${requirement.id}/edit`}
                      aria-label={`Edit ${label}`}
                      className="self-start text-sm font-semibold text-blue underline-offset-2 hover:underline sm:mt-1"
                    >
                      Edit
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {addLink ? <div className="mt-4">{addLink}</div> : null}
        </>
      )}
      {!showNotes && requirements.length > 0 ? (
        <p className="mt-4 text-sm text-ink-2">
          Notes on accessibility needs are visible to Owners and Coordinators.
        </p>
      ) : null}
    </DetailSection>
  );
}