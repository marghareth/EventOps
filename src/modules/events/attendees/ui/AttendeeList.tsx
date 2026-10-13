// src/modules/events/attendees/ui/AttendeeList.tsx
// The guest list (B2-02): a table, by name. Each name links to the attendee's details page, for
// every member (B2-07); editing starts there (B2-03). Dietary needs appear as a column for roles that may see them (B2-06,
// D-047); the page decides, from what the server loaded. Search, filters, sorting and row actions
// arrive with their own tasks. On narrow screens the table scrolls sideways inside its own
// keyboard-focusable region, never the whole page.
import Link from "next/link";
import { formatAttendeeReference, type AttendeeInput } from "../schema";
import { RsvpBadge } from "./RsvpBadge";

export type AttendeeListItem = Pick<
  AttendeeInput,
  "name" | "rsvpStatus" | "plusOnes" | "category"
> & { id: string; number: number; dietaryNeeds?: string | null };

const th =
  "bg-mist px-4 py-3.5 text-left font-display text-xs font-bold tracking-wider whitespace-nowrap text-ink-2 uppercase";
const td = "border-t border-line px-4 py-3.5 align-middle";

type AttendeeListProps = {
  attendees: readonly AttendeeListItem[];
  /** The details page for an attendee ID (B2-07). Without it, names are plain text. */
  detailsHref?: (attendeeId: string) => string;
  /** Show the dietary needs column (attendees.dietary, D-047). */
  showDietaryNeeds?: boolean;
  /** The current sort, marked on its column header for screen readers (B2-12, D-050). */
  sort?: { column: SortColumn; direction: "ascending" | "descending"; label: string };
};

/** "Guest list, by name" by default; otherwise the sort in words. */
function sortCaption(sort: AttendeeListProps["sort"]) {
  if (!sort || (sort.column === "name" && sort.direction === "ascending")) {
    return "Guest list, by name";
  }
  return `Guest list, sorted by ${sort.label}, ${sort.direction}`;
}

export type SortColumn = "id" | "name" | "rsvp" | "plusones" | "category";

/** An empty cell: a dash on screen, words for screen readers. */
function Empty({ label }: { label: string }) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">—</span>
    </>
  );
}

export function AttendeeList({
  attendees,
  detailsHref,
  showDietaryNeeds = false,
  sort,
}: AttendeeListProps) {
  const ariaSort = (column: SortColumn) => (sort?.column === column ? sort.direction : undefined);
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
          {sortCaption(sort)}
          {detailsHref ? ". Select a name to see that attendee's details." : null}
        </caption>
        <thead>
          <tr>
            <th scope="col" className={th} aria-sort={ariaSort("id")}>
              ID
            </th>
            <th scope="col" className={th} aria-sort={ariaSort("name")}>
              Name
            </th>
            <th scope="col" className={th} aria-sort={ariaSort("rsvp")}>
              RSVP
            </th>
            <th scope="col" className={`${th} text-right`} aria-sort={ariaSort("plusones")}>
              Plus-ones
            </th>
            <th scope="col" className={th} aria-sort={ariaSort("category")}>
              Category
            </th>
            {showDietaryNeeds ? (
              <th scope="col" className={th}>
                Dietary needs
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {attendees.map((attendee) => (
            <tr key={attendee.id} className="hover:bg-paper">
              <td className={`${td} font-mono text-[13px] whitespace-nowrap text-ink-2`}>
                {formatAttendeeReference(attendee.number)}
              </td>
              <th scope="row" className={`${td} min-w-40 text-left font-semibold wrapbreak-word`}>
                {detailsHref ? (
                  <Link
                    href={detailsHref(attendee.id)}
                    className="text-blue underline-offset-2 hover:underline"
                  >
                    {attendee.name}
                  </Link>
                ) : (
                  attendee.name
                )}
              </th>
              <td className={td}>
                <RsvpBadge status={attendee.rsvpStatus} />
              </td>
              <td className={`${td} text-right tabular-nums`}>{attendee.plusOnes}</td>
              <td className={`${td} wrap-break-word text-ink-2`}>
                {attendee.category ?? <Empty label="None" />}
              </td>
              {showDietaryNeeds ? (
                <td
                  className={`${td} max-w-72 min-w-48 wrap-break-word whitespace-pre-line text-ink-2`}
                >
                  {/* Empty means nothing was recorded, not "no restrictions". */}
                  {attendee.dietaryNeeds ?? <Empty label="Not recorded" />}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}