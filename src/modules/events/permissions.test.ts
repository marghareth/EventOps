// src/modules/events/permissions.test.ts
// @vitest-environment node
// The permission matrix (D-035): the code must match docs/PERMISSIONS.md cell by cell, and the
// approved role boundaries hold.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MEMBER_ROLES, PERMISSIONS, ROLE_SUMMARY, can, rolesAllowed } from "./permissions";

/** Rows of the "## Matrix" table in docs/PERMISSIONS.md: permission -> [Owner, Coordinator, Viewer]. */
function documentedMatrix(): Record<string, boolean[]> {
  const doc = readFileSync(join(process.cwd(), "docs/PERMISSIONS.md"), "utf8");
  const section = doc.split("## Matrix")[1].split("\n## ")[0];
  const rows: Record<string, boolean[]> = {};
  for (const line of section.split("\n")) {
    const match =
      /^\|\s*`([a-z.]+)`\s*\|[^|]*\|\s*(Yes|No)\s*\|\s*(Yes|No)\s*\|\s*(Yes|No)\s*\|/.exec(line);
    if (match) rows[match[1]] = [match[2], match[3], match[4]].map((cell) => cell === "Yes");
  }
  return rows;
}

describe("permission matrix", () => {
  it("matches docs/PERMISSIONS.md exactly, permission by permission and role by role", () => {
    const documented = documentedMatrix();
    expect(Object.keys(documented).sort()).toEqual([...PERMISSIONS].sort());
    for (const permission of PERMISSIONS) {
      expect(
        MEMBER_ROLES.map((role) => can(role, permission)),
        permission,
      ).toEqual(documented[permission]);
    }
  });

  it("covers exactly the three roles", () => {
    expect(MEMBER_ROLES).toEqual(["OWNER", "COORDINATOR", "VIEWER"]);
    expect(Object.keys(ROLE_SUMMARY).sort()).toEqual(["COORDINATOR", "OWNER", "VIEWER"]);
  });

  it("Viewer can only view: the event, and attendees' dietary needs (D-047)", () => {
    expect(PERMISSIONS.filter((permission) => can("VIEWER", permission))).toEqual([
      "event.view",
      "attendees.dietary",
    ]);
  });

  it("Owner can do everything", () => {
    expect(PERMISSIONS.every((permission) => can("OWNER", permission))).toBe(true);
  });

  it("Owner-only operations are deleting the event and managing members", () => {
    expect(PERMISSIONS.filter((permission) => !can("COORDINATOR", permission))).toEqual([
      "event.delete",
      "members.manage",
    ]);
  });

  // The requirement edit form loads the note for anyone who may manage accessibility; saving it
  // without the note would erase it. So every manager must also be allowed to see notes (B3-19).
  it("lets every role that manages accessibility also see accessibility notes", () => {
    const managers = rolesAllowed("accessibility.manage");
    const readers = rolesAllowed("accessibility.private");
    expect(managers.filter((role) => !readers.includes(role))).toEqual([]);
  });

  it("every permission allows at least the Owner, and lists no role twice", () => {
    for (const permission of PERMISSIONS) {
      const roles = rolesAllowed(permission);
      expect(roles).toContain("OWNER");
      expect(new Set(roles).size).toBe(roles.length);
    }
  });
});