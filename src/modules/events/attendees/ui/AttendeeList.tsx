// src/modules/events/attendees/ui/AttendeeList.tsx
// The guest list (B2-02): a read-only table, by name. Search, filters, sorting and row actions
// arrive with their own tasks. On narrow screens the table scrolls sideways inside its own
// keyboard-focusable region, never the whole page.
import { formatAttendeeReference, type AttendeeInput } from "../schema";
import { RsvpBadge } from "./RsvpBadge";

export type AttendeeListItem = Pick<
  AttendeeInput,
  "name" | "rsvpStatus" | "plusOnes" | "category"
> & { id: string; number: number };

const th =
  "bg-mist px-4 py-3.5 text-left font-display text-xs font-bold tracking-wider whitespace-nowrap text-ink-2 uppercase";
const td = "border-t border-line px-4 py-3.5 align-middle";

export function AttendeeList({ attendees }: { attendees: readonly AttendeeListItem[] }) {
  return (
    <div
      role="region"
      aria-labelledby="attendee-list-caption"
      tabIndex={0}
      // relative: visually hidden text (sr-only, absolutely positioned) stays inside the scroll
      // box instead of widening the page on phones.
      className="relative overflow-x-auto rounded-lg border border-line bg-white"
    >
      <table className="w-full border-collapse text-sm">
        <caption id="attendee-list-caption" className="sr-only">
          Guest list, by name
        </caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              ID
            </th>
            <th scope="col" className={th}>
              Name
            </th>
            <th scope="col" className={th}>
              RSVP
            </th>
            <th scope="col" className={`${th} text-right`}>
              Plus-ones
            </th>
            <th scope="col" className={th}>
              Category
            </th>
          </tr>
        </thead>
        <tbody>
          {attendees.map((attendee) => (
            <tr key={attendee.id} className="hover:bg-paper">
              <td className={`${td} font-mono text-[13px] whitespace-nowrap text-ink-2`}>
                {formatAttendeeReference(attendee.number)}
              </td>
              <th scope="row" className={`${td} min-w-40 text-left font-semibold wrap-break-word`}>
                {attendee.name}
              </th>
              <td className={td}>
                <RsvpBadge status={attendee.rsvpStatus} />
              </td>
              <td className={`${td} text-right tabular-nums`}>{attendee.plusOnes}</td>
              <td className={`${td} wrap-break-word text-ink-2`}>
                {attendee.category ?? <span className="sr-only">None</span>}
                {attendee.category ? null : <span aria-hidden="true">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}