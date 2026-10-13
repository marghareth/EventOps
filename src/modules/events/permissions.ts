// src/modules/events/permissions.ts
// The event permission matrix (D-035; first rows in D-031 and D-033). The single source of truth
// for what each role may do inside an event. docs/PERMISSIONS.md shows the same table, and
// permissions.test.ts fails if the two differ. Change a row only with the technical lead's approval,
// and update both together.
//
// How it is used: membership is checked first (requireEventAccess / getEventAccess, D-027); then a
// write checks the member's role with can(role, permission) on the server, and the database write
// filters by rolesAllowed(permission) again where it can. Pages also use can() to hide controls, but
// hiding is never the check.
import type { MemberRole } from "@/generated/prisma/client";

const MATRIX = {
  /** Open the event, its sections and dashboard. Every member. */
  "event.view": ["OWNER", "COORDINATOR", "VIEWER"],
  /** Edit the event's details (B1-05, D-031). */
  "event.edit": ["OWNER", "COORDINATOR"],
  /** Change the event's status. */
  "event.status": ["OWNER", "COORDINATOR"],
  /** Permanently delete the event and everything in it (B1-06, D-033). */
  "event.delete": ["OWNER"],
  /** Add members, change their roles and remove them. */
  "members.manage": ["OWNER"],
  /** Add, edit and remove attendees, RSVP and plus-ones. */
  "attendees.manage": ["OWNER", "COORDINATOR"],
  /** See attendees' dietary needs on the guest list (B2-06, D-047). Viewers read them too. */
  "attendees.dietary": ["OWNER", "COORDINATOR", "VIEWER"],
  /** See attendees' contact details (email, phone) and notes (B2-07, D-048). */
  "attendees.private": ["OWNER", "COORDINATOR"],
  /** Download attendees as CSV (guest personal data). */
  "attendees.export": ["OWNER", "COORDINATOR"],
  /** Spreadsheet or AI import, including confirming the rows. */
  "import.run": ["OWNER", "COORDINATOR"],
  /** Accessibility requirements and resources. */
  "accessibility.manage": ["OWNER", "COORDINATOR"],
  /** Suppliers, quotes and payments. */
  "suppliers.manage": ["OWNER", "COORDINATOR"],
  /** Budget categories and allocations. */
  "budget.manage": ["OWNER", "COORDINATOR"],
  /** Create, assign and complete tasks. */
  "tasks.manage": ["OWNER", "COORDINATOR"],
  /** Edit impact assumptions such as cost per head. */
  "impact.assumptions": ["OWNER", "COORDINATOR"],
  /** See the activity log, including before and after values. */
  "audit.view": ["OWNER", "COORDINATOR"],
} as const satisfies Record<string, readonly MemberRole[]>;

export type Permission = keyof typeof MATRIX;

export const PERMISSIONS = Object.keys(MATRIX) as Permission[];

export const MEMBER_ROLES: readonly MemberRole[] = ["OWNER", "COORDINATOR", "VIEWER"];

/** What each role is for, in one line. Shown to members; it never decides anything. */
export const ROLE_SUMMARY: Record<MemberRole, string> = {
  OWNER: "Full event management, including members and deleting the event.",
  COORDINATOR:
    "Day-to-day operations: event details, guests, suppliers, budget and tasks. Can't manage members or delete the event.",
  VIEWER: "Read-only access to the event.",
};

export function rolesAllowed(permission: Permission): readonly MemberRole[] {
  return MATRIX[permission];
}

export function can(role: MemberRole, permission: Permission): boolean {
  return rolesAllowed(permission).includes(role);
}