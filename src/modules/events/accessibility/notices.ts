// src/modules/events/accessibility/notices.ts
// The notices the attendee details page may show after an accessibility change (B3-04). A plain
// module, not a client component file: values exported from a "use client" file reach server code
// only as client references, so the page reads the list from here.
export const ACCESSIBILITY_NOTICES = ["added", "saved", "removed"] as const;
export type AccessibilityNoticeKind = (typeof ACCESSIBILITY_NOTICES)[number];

/** The notices the Accessibility page may show after a resource change (B3-05). */
export const RESOURCE_NOTICES = ["saved", "removed"] as const;
export type ResourceNoticeKind = (typeof RESOURCE_NOTICES)[number];