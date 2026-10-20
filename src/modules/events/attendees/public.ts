// src/modules/events/attendees/public.ts
// The attendees context's public interface (D-001): only what other parts of the app use. Code
// inside the module (and its tests) imports its own files directly. knip fails the build when an
// export here is unused, so this list stays honest.
export { createAttendeeAction, deleteAttendeeAction, updateAttendeeAction } from "./actions";
export { rsvpCounts } from "./rsvp-filter";
export {
  SORT_LABEL,
  applyGuestListQuery,
  categoriesOf,
  describeCriteria,
  guestListQueryString,
  hasCriteriaBeyondRsvp,
  isNarrowed,
  parseGuestListQuery,
  type GuestListQuery,
} from "./guest-list-query";
export { expectedHeadcount } from "./headcount";
export {
  getAttendeeDetails,
  getAttendeeForEditing,
  getAttendeeHealthFacts,
  getEventAttendees,
} from "./read";
export {
  isAttendeeReference,
  RSVP_LABEL,
  attendeeFormSchema,
  formatAttendeeReference,
  toAttendeeFormValues,
} from "./schema";
export { AttendeeDetailsSection, AttendeeNotesSection } from "./ui/AttendeeDetailsView";
export { AttendeeNotice } from "./ui/AttendeeNotice";
export { AttendeeForm } from "./ui/AttendeeForm";
export { AttendeeList } from "./ui/AttendeeList";
export { ExportButton } from "./ui/ExportButton";
export { GuestListControls } from "./ui/GuestListControls";
export { exportEventAttendees } from "./export-attendees";
export { attendeesCsv, exportFileName } from "./export-csv";
// Import (B2-14 to B2-18; the wizard moved to the import context in Batch 9, D-109).
export { CSV_LIMITS, parseCsv, toCsv, type CsvTable } from "./csv";
export { importAttendees } from "./import-attendees";
export {
  HEADER_SYNONYMS as ATTENDEE_IMPORT_HEADER_WORDS,
  IMPORT_FIELDS as ATTENDEE_IMPORT_FIELDS,
  IMPORT_FIELD_LABEL as ATTENDEE_IMPORT_FIELD_LABEL,
  REQUIRED_IMPORT_FIELDS as REQUIRED_ATTENDEE_IMPORT_FIELDS,
  attendeesToImport,
  buildImportPreview as buildAttendeeImportPreview,
  readMapping as readAttendeeMapping,
} from "./import-rules";
export { listAttendeeIdentities } from "./queries";
export { HeadcountSummary } from "./ui/HeadcountSummary";
export { RemoveAttendeeSection } from "./ui/RemoveAttendeeSection";
export { RsvpBadge } from "./ui/RsvpBadge";
export { RsvpFilter } from "./ui/RsvpFilter";