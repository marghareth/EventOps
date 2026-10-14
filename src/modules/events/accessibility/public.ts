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
export { RESOURCE_TYPE_DEFINITIONS, isResourceType } from "./domain/resource";
export {
  getAttendeeAccessibility,
  getEventResources,
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