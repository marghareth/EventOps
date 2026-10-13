// src/modules/events/attendees/ui/AttendeeDetailsView.tsx
// One attendee's details (B2-07, D-048), read-only. Shows only the fields the server loaded for the
// reader's role: dietary needs with attendees.dietary; email, phone and notes with
// attendees.private. Text is rendered as text (React escapes it) and notes keep their line breaks.
import { DetailSection } from "@/components/shared/DetailSection";
import type { AttendeeDetails } from "../queries";

type Props = {
  attendee: AttendeeDetails;
  fields: { dietaryNeeds: boolean; private: boolean };
};

const dt = "text-sm font-semibold text-ink-2";
const dd = "mt-1 break-words text-ink";

/** An empty value: a dash on screen, words for screen readers. */
function Empty({ label }: { label: string }) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="text-ink-2">
        —
      </span>
    </>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className={dt}>{label}</dt>
      <dd className={dd}>
        {value === null || value === undefined ? <Empty label="Not recorded" /> : value}
      </dd>
    </div>
  );
}

/** Details: plus-ones, category, and the fields the role received (B2-07, B2-13). */
export function AttendeeDetailsSection({ attendee, fields }: Props) {
  return (
    <DetailSection id="attendee-details" title="Details">
      <dl className="mt-4 grid gap-5 sm:grid-cols-2">
        <Field label="Plus-ones" value={attendee.plusOnes} />
        <Field label="Category" value={attendee.category} />
        {fields.dietaryNeeds ? (
          <div className="sm:col-span-2">
            <dt className={dt}>Dietary needs</dt>
            <dd className={`${dd} whitespace-pre-line`}>
              {attendee.dietaryNeeds ?? <Empty label="Not recorded" />}
            </dd>
          </div>
        ) : null}
        {fields.private ? (
          <>
            <Field label="Email" value={attendee.email} />
            <Field label="Phone" value={attendee.phone} />
          </>
        ) : null}
      </dl>
    </DetailSection>
  );
}

/**
 * Notes for roles with attendees.private; for others, one line saying who can see contact details
 * and notes (B2-07, D-048).
 */
export function AttendeeNotesSection({ attendee, fields }: Props) {
  if (!fields.private) {
    return (
      <p className="text-sm text-ink-2">
        Contact details and notes are visible to Owners and Coordinators.
      </p>
    );
  }
  return (
    <DetailSection id="attendee-notes" title="Notes">
      {attendee.notes ? (
        <p className="mt-3 wrap-break-words whitespace-pre-wrap text-ink">{attendee.notes}</p>
      ) : (
        <p className="mt-3 text-ink-2">No notes.</p>
      )}
    </DetailSection>
  );
}

/** Both attendee sections, in order. The details page composes them itself (B2-13). */
export function AttendeeDetailsView(props: Props) {
  return (
    <div className="flex flex-col gap-6">
      <AttendeeDetailsSection {...props} />
      <AttendeeNotesSection {...props} />
    </div>
  );
}