// src/modules/events/permissions.ts
// The permission matrix (D-031, D-033). Each entry lists the roles allowed to do something inside an
// event. Membership is checked first (requireEventAccess / getEventAccess, D-027); this decides
// what a member's role may change. Rows are added only when the technical lead approves them.
import type { MemberRole } from "@/generated/prisma/client";

const MATRIX = {
  /** Edit the event's details (B1-05). */
  "event.edit": ["OWNER", "COORDINATOR"],
  /** Permanently delete the event and everything in it (B1-06, D-004). */
  "event.delete": ["OWNER"],
} as const satisfies Record<string, readonly MemberRole[]>;

export type Permission = keyof typeof MATRIX;

export function rolesAllowed(permission: Permission): readonly MemberRole[] {
  return MATRIX[permission];
}

export function can(role: MemberRole, permission: Permission): boolean {
  return rolesAllowed(permission).includes(role);
}