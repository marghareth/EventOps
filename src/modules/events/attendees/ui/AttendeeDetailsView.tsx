// src/modules/events/attendees/ui/AttendeeDetailsView.tsx
// One attendee's details (B2-07, D-048), read-only. Shows only the fields the server loaded for the
// reader's role: dietary needs with attendees.dietary; email, phone and notes with
// attendees.private. Text is rendered as text (React escapes it) and notes keep their line breaks.
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

export function AttendeeDetailsView({ attendee, fields }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="attendee-details-heading"
        className="rounded-xl bg-white p-6 shadow-xs sm:p-8"
      >
        <h2 id="attendee-details-heading" className="text-h4 font-bold">
          Details
        </h2>
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
      </section>

      {fields.private ? (
        <section
          aria-labelledby="attendee-notes-heading"
          className="rounded-xl bg-white p-6 shadow-xs sm:p-8"
        >
          <h2 id="attendee-notes-heading" className="text-h4 font-bold">
            Notes
          </h2>
          {attendee.notes ? (
            <p className="mt-3 break-words whitespace-pre-wrap text-ink">{attendee.notes}</p>
          ) : (
            <p className="mt-3 text-ink-2">No notes.</p>
          )}
        </section>
      ) : (
        <p className="text-sm text-ink-2">
          Contact details and notes are visible to Owners and Coordinators.
        </p>
      )}
    </div>
  );
}