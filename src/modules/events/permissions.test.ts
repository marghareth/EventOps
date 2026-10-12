// src/modules/events/permissions.test.ts
// @vitest-environment node
import { expect, it } from "vitest";
import { can, rolesAllowed } from "./permissions";

it.each([
  ["OWNER", true],
  ["COORDINATOR", true],
  ["VIEWER", false],
] as const)("event.edit: %s -> %s", (role, allowed) => {
  expect(can(role, "event.edit")).toBe(allowed);
});

it("lists the roles for a permission", () => {
  expect(rolesAllowed("event.edit")).toEqual(["OWNER", "COORDINATOR"]);
});