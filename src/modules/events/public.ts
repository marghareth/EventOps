// src/modules/events/public.ts
// The events context's public interface. Pages and other contexts import from here only (D-001).
export { getEventAccess, requireEventAccess, type EventAccess } from "./access";
export { getEventActivity, type EventActivity } from "./activity";
export {
  authorizeEvent,
  authorizeEventRequest,
  jsonError,
  type EventAuthorization,
} from "./authorize";
export { createEventAction, deleteEventAction, updateEventAction } from "./actions";
export { ROLE_SUMMARY, can, rolesAllowed, type Permission } from "./permissions";
export { toEventFormValues } from "./schema";
export { MEMBER_ROLE_LABEL, groupEvents, type EventDetails, type EventListItem } from "./list";
export { getMyEvents } from "./queries";
// Dev-only sample data (D-041), for the attendees context's stand-ins.
export {
  sampleCreateAttendee,
  sampleGetAttendee,
  sampleListAttendees,
  sampleUpdateAttendee,
  type SampleAttendee,
  type SampleAttendeeInput,
} from "./sample-data";
export { isEventReference } from "./reference";
export { CreateEventForm } from "./ui/CreateEventForm";
export { DeleteEventSection } from "./ui/DeleteEventSection";
export { EditEventForm } from "./ui/EditEventForm";
export { EventCreatedNotice } from "./ui/EventCreatedNotice";
export { EventDeletedNotice } from "./ui/EventDeletedNotice";
export { EventHeader } from "./ui/EventHeader";
export { EventList } from "./ui/EventList";
export { EventDetailsCard, SectionTiles, type SectionTile } from "./ui/EventOverview";