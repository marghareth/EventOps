// src/lib/env.server.test.ts
import { describe, expect, it } from "vitest";
import { parseAiImportEnv, parseServerEnv } from "./env.server";

const valid = {
  DATABASE_URL: "postgresql://user:pass@localhost:6543/postgres",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/postgres",
};

describe("parseServerEnv", () => {
  it("accepts a complete server environment and defaults AI import to false", () => {
    expect(parseServerEnv(valid).AI_IMPORT_ENABLED).toBe("false");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: undefined })).toThrow();
  });

  it("rejects an AI_IMPORT_ENABLED value that is not true or false", () => {
    expect(() => parseServerEnv({ ...valid, AI_IMPORT_ENABLED: "yes" })).toThrow();
  });
});

describe("parseAiImportEnv (D-112)", () => {
  it("reads the AI settings without the database ones, blank as not set", () => {
    expect(parseAiImportEnv({ OLLAMA_URL: "", OLLAMA_MODEL: "" })).toEqual({
      AI_IMPORT_ENABLED: "false",
      OLLAMA_URL: undefined,
      OLLAMA_MODEL: undefined,
    });
    expect(
      parseAiImportEnv({ AI_IMPORT_ENABLED: "true", OLLAMA_URL: "http://localhost:11434" }),
    ).toMatchObject({ AI_IMPORT_ENABLED: "true", OLLAMA_URL: "http://localhost:11434" });
  });

  it("refuses an Ollama address that isn't http or https, and odd model names", () => {
    expect(() => parseAiImportEnv({ OLLAMA_URL: "file:///etc/passwd" })).toThrow();
    expect(() => parseAiImportEnv({ OLLAMA_URL: "not a url" })).toThrow();
    expect(() => parseAiImportEnv({ OLLAMA_MODEL: "qwen; rm -rf" })).toThrow();
  });
});