// src/modules/events/public.ts
// The events context's public interface. Pages and other contexts import from here only (D-001).
export { getEventAccess, requireEventAccess } from "./access";
export { getEventActivity } from "./activity";
export {
  authorizeEvent,
  authorizeEventRequest,
  jsonError,
  type EventAuthorization,
} from "./authorize";
export { createEventAction, deleteEventAction, updateEventAction } from "./actions";
export { ROLE_SUMMARY, can, rolesAllowed } from "./permissions";
export { toEventFormValues } from "./schema";
export { MEMBER_ROLE_LABEL, groupEvents } from "./list";
export { getMyEvents } from "./queries";
// Dev-only sample data (D-041), for the attendees, accessibility and suppliers contexts' stand-ins.
export {
  sampleCreateAttendee,
  sampleCreatePayment,
  sampleCreateQuote,
  sampleCreateRequirement,
  sampleCreateResource,
  sampleCreateSupplier,
  sampleDeleteAttendee,
  sampleDeleteRequirement,
  sampleDeleteResource,
  sampleDeleteSupplier,
  sampleExportAttendees,
  sampleGetAttendee,
  sampleGetPayment,
  sampleGetQuote,
  sampleGetSupplier,
  sampleImportAttendees,
  sampleImportSuppliers,
  sampleListAttendees,
  sampleListAuditEntries,
  sampleListEventPayments,
  sampleListEventRequirements,
  sampleListPayments,
  sampleListQuotes,
  sampleListRequirements,
  sampleListResources,
  sampleListSuppliers,
  sampleUpdateAttendee,
  sampleUpdatePayment,
  sampleUpdateQuote,
  sampleUpdateRequirement,
  sampleUpdateResource,
  sampleUpdateSupplier,
} from "./sample-data";
export { isEventReference } from "./reference";
export { CreateEventForm } from "./ui/CreateEventForm";
export { DeleteEventSection } from "./ui/DeleteEventSection";
export { EditEventForm } from "./ui/EditEventForm";
export { EventCreatedNotice } from "./ui/EventCreatedNotice";
export { EventDeletedNotice } from "./ui/EventDeletedNotice";
export { EventHeader } from "./ui/EventHeader";
export { EventList } from "./ui/EventList";
export { EventDetailsCard, SectionTiles } from "./ui/EventOverview";

// The context's public types (D-001). Not every one is imported yet; they are the contract other
// contexts build on, so knip is told they are intentional.
/** @public */
export type { EventAccess } from "./access";
/** @public */
export type { EventActivity } from "./activity";
/** @public */
export type { Permission } from "./permissions";
/** @public */
export type { EventDetails, EventListItem } from "./list";
/** @public */
export type { SampleAttendee, SampleAttendeeInput } from "./sample-data";
/** @public */
export type { SectionTile } from "./ui/EventOverview";