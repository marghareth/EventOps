// src/modules/events/public.ts
// The events context's public interface. Pages and other contexts import from here only (D-001).
export { getEventAccess, requireEventAccess, type EventAccess } from "./access";
export { createEventAction, deleteEventAction, updateEventAction } from "./actions";
export { ROLE_SUMMARY, can, type Permission } from "./permissions";
export { toEventFormValues } from "./schema";
export { MEMBER_ROLE_LABEL, groupEvents, type EventDetails, type EventListItem } from "./list";
export { getMyEvents, type MyEventsResult } from "./queries";
export { isEventReference } from "./reference";
export { CreateEventForm } from "./ui/CreateEventForm";
export { DeleteEventSection } from "./ui/DeleteEventSection";
export { EditEventForm } from "./ui/EditEventForm";
export { EventCreatedNotice } from "./ui/EventCreatedNotice";
export { EventDeletedNotice } from "./ui/EventDeletedNotice";
export { EventHeader } from "./ui/EventHeader";
export { EventList } from "./ui/EventList";
export { EventDetailsCard, SectionTiles, type SectionTile } from "./ui/EventOverview";