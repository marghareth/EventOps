// src/modules/events/public.ts
// The events context's public interface. Pages and other contexts import from here only (D-001).
export { getEventAccess, requireEventAccess, type EventAccess } from "./access";
export { createEventAction } from "./actions";
export { groupEvents, type EventDetails, type EventListItem } from "./list";
export { getMyEvents, type MyEventsResult } from "./queries";
export { isEventReference } from "./reference";
export { CreateEventForm } from "./ui/CreateEventForm";
export { EventCreatedNotice } from "./ui/EventCreatedNotice";
export { EventHeader } from "./ui/EventHeader";
export { EventList } from "./ui/EventList";
export { EventDetailsCard, SectionTiles, type SectionTile } from "./ui/EventOverview";