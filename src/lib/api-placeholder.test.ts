// src/lib/api-placeholder.test.ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.fn();
vi.mock("./auth", () => ({ getCurrentUser: () => getCurrentUser() }));

const { placeholderRouteResponse } = await import("./api-placeholder");

beforeEach(() => getCurrentUser.mockReset());

describe("placeholderRouteResponse", () => {
  it("answers 401 to a signed-out caller", async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = await placeholderRouteResponse();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Sign in to continue." });
  });

  it("answers 501 Not Implemented to a signed-in caller, with no data", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", email: "mika@example.com" });
    const response = await placeholderRouteResponse();
    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({ error: "Not implemented yet." });
  });
});