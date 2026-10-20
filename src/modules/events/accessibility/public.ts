// src/modules/events/accessibility/public.ts
// The accessibility context's public interface (D-001): only what pages and other contexts use.
// Server code and client components are both exported here, so client components must import
// their own context's files directly, never this file (D-043).
export {
  createRequirementAction,
  deleteRequirementAction,
  deleteResourceAction,
  saveResourceAction,
  updateRequirementAction,
} from "./actions";
export { REQUIREMENT_TYPE_DEFINITIONS, isRequirementType } from "./domain/requirement-type";
export { READINESS_STATUS_DEFINITIONS } from "./domain/readiness-status";
export { RESOURCE_TYPE_DEFINITIONS, isResourceType } from "./domain/resource";
export {
  getAttendeeAccessibility,
  getAccessibilityAlerts,
  getAccessibilityOverview,
  getNewRequirementContext,
  getRequirementForEditing,
  getResourceForEditing,
} from "./queries";
export { toRequirementFormValues, toResourceFormValues } from "./schema";
export { ACCESSIBILITY_NOTICES, RESOURCE_NOTICES } from "./notices";
export { AccessibilityNotice } from "./ui/AccessibilityNotice";
export { AccessibilitySection } from "./ui/AccessibilitySection";
export { RemoveRequirementSection } from "./ui/RemoveRequirementSection";
export { RequirementForm } from "./ui/RequirementForm";
export { RemoveResourceSection } from "./ui/RemoveResourceSection";
export { ResourceForm } from "./ui/ResourceForm";
export { ResourceList } from "./ui/ResourceList";
export { ResourceNotice } from "./ui/ResourceNotice";
export { GapList } from "./ui/GapList";
export { NeedsOverview } from "./ui/NeedsOverview";
export { ReadinessSummary } from "./ui/ReadinessSummary";
export { AccessibilityAlertsUnavailable, GuestAccessibilityAlerts } from "./ui/AccessibilityAlerts";