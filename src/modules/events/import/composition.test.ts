// src/modules/events/import/composition.test.ts
// @vitest-environment node
// When the model is asked (D-112): only with AI_IMPORT_ENABLED=true and an Ollama address.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { columnSuggester } = await import("./composition");

describe("columnSuggester", () => {
  it("is off unless AI import is enabled and an Ollama address is set", () => {
    expect(columnSuggester({})).toBeNull();
    expect(columnSuggester({ AI_IMPORT_ENABLED: "true" })).toBeNull();
    expect(
      columnSuggester({ AI_IMPORT_ENABLED: "false", OLLAMA_URL: "http://localhost:11434" }),
    ).toBeNull();
    expect(
      columnSuggester({ AI_IMPORT_ENABLED: "true", OLLAMA_URL: "http://localhost:11434" })?.label,
    ).toBe("Qwen2.5 7B Instruct (Apache-2.0)");
  });

  it("is off, not broken, when the settings are invalid", () => {
    expect(columnSuggester({ AI_IMPORT_ENABLED: "true", OLLAMA_URL: "file:///x" })).toBeNull();
  });
});