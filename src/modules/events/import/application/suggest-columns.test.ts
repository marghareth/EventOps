// src/modules/events/import/application/suggest-columns.test.ts
// @vitest-environment node
// The column suggestion (B9-F12 to F15; D-111, D-112): the model's answer is used only after the
// business checks; otherwise the deterministic matcher's, with the reason.
import { describe, expect, it, vi } from "vitest";
import type { ColumnSuggester, SuggesterResult, SuggestionRequest } from "./ports";
import { mappingFromOutput, suggestColumns, type ImportTargetRules } from "./suggest-columns";

const target = (
  fields: string[],
  required: string[],
  words: Record<string, string[]>,
): ImportTargetRules => ({
  fields: fields.map((id) => ({ id, label: id })),
  rules: fields.map((field) => ({ field, words: words[field] ?? [] })),
  isValidMapping: (mapping) =>
    required.every((f) => mapping.includes(f)) &&
    mapping.every((f, i) => f === null || (fields.includes(f) && mapping.indexOf(f) === i)),
});

const TARGETS = {
  attendees: target(["name", "email", "rsvpStatus"], ["name"], {
    name: ["name", "guest"],
    email: ["email"],
    rsvpStatus: ["rsvp"],
  }),
  suppliers: target(["name", "category", "email"], ["name", "category"], {
    name: ["name", "vendor"],
    category: ["category", "service"],
    email: ["email"],
  }),
};

const table = {
  headers: ["Who", "Reply", "E-mail"],
  rows: [
    { cells: ["Ana Reyes", "yes", "ana@example.com"] },
    { cells: ["Ben Lim", "no", "ben@example.com"] },
    { cells: ["Carla Santos", "", "carla@example.com"] },
    { cells: ["Dan Cruz", "", "dan@example.com"] },
  ],
};

const suggester = (result: SuggesterResult) => {
  const suggest = vi.fn<(request: SuggestionRequest) => Promise<SuggesterResult>>(
    async () => result,
  );
  return { label: "Qwen2.5 7B Instruct (Apache-2.0)", suggest } satisfies ColumnSuggester;
};

describe("suggestColumns", () => {
  it("uses the rules, saying AI is off, when there is no model", async () => {
    expect(
      await suggestColumns({ table, importType: "attendees", targets: TARGETS, suggester: null }),
    ).toEqual({
      mapping: [null, null, "email"],
      columnTypes: ["text", "yesno", "email"],
      looksLike: null,
      source: "rules",
      fallback: "off",
    });
  });

  it("shows the model headers, types and at most 3 samples of 40 characters (D-111)", async () => {
    const model = suggester({ ok: false, reason: "unavailable" });
    const long = {
      headers: ["Notes"],
      rows: Array.from({ length: 5 }, () => ({ cells: ["x".repeat(90)] })),
    };
    await suggestColumns({
      table: long,
      importType: "attendees",
      targets: TARGETS,
      suggester: model,
    });
    const request = model.suggest.mock.calls[0][0];
    expect(request.columns).toEqual([
      {
        index: 0,
        header: "Notes",
        type: "text",
        samples: ["x".repeat(40), "x".repeat(40), "x".repeat(40)],
      },
    ]);
    expect(request.fieldsByType.suppliers.map((f) => f.id)).toEqual(["name", "category", "email"]);
  });

  it("uses a valid answer from the model and reports the type the columns look like", async () => {
    const model = suggester({
      ok: true,
      output: {
        looksLike: "attendees",
        columns: [
          { index: 0, field: "name" },
          { index: 1, field: "rsvpStatus" },
          { index: 2, field: "email" },
        ],
      },
    });
    expect(
      await suggestColumns({ table, importType: "attendees", targets: TARGETS, suggester: model }),
    ).toMatchObject({
      mapping: ["name", "rsvpStatus", "email"],
      source: "ai",
      model: "Qwen2.5 7B Instruct (Apache-2.0)",
      looksLike: null,
    });
  });

  it.each([
    ["unreachable", { ok: false, reason: "unavailable" } as const, "unavailable"],
    ["too slow", { ok: false, reason: "timeout" } as const, "unavailable"],
    ["not valid JSON", { ok: false, reason: "invalid" } as const, "unavailable"],
  ])("falls back to the rules when the model is %s (D-112)", async (_label, result, fallback) => {
    expect(
      await suggestColumns({
        table,
        importType: "attendees",
        targets: TARGETS,
        suggester: suggester(result),
      }),
    ).toMatchObject({ mapping: [null, null, "email"], source: "rules", fallback });
  });

  it.each([
    [
      "a field of the other type",
      [
        { index: 0, field: "name" },
        { index: 1, field: "category" },
      ],
    ],
    [
      "an invented field",
      [
        { index: 0, field: "name" },
        { index: 1, field: "salary" },
      ],
    ],
    [
      "a field twice",
      [
        { index: 0, field: "name" },
        { index: 1, field: "email" },
        { index: 2, field: "email" },
      ],
    ],
    ["no required field", [{ index: 2, field: "email" }]],
    [
      "a column out of range",
      [
        { index: 0, field: "name" },
        { index: 7, field: "email" },
      ],
    ],
    [
      "a column twice",
      [
        { index: 0, field: "name" },
        { index: 0, field: null },
      ],
    ],
  ])("refuses an answer with %s and uses the rules (D-111)", async (_label, columns) => {
    const model = suggester({ ok: true, output: { looksLike: "attendees", columns } });
    expect(
      await suggestColumns({ table, importType: "attendees", targets: TARGETS, suggester: model }),
    ).toMatchObject({ source: "rules", fallback: "rejected", mapping: [null, null, "email"] });
  });

  it("says when the columns look like the other type, by rules or by the model", async () => {
    const vendors = { headers: ["Vendor", "Service"], rows: [{ cells: ["Bloom Co.", "Florist"] }] };
    expect(
      await suggestColumns({
        table: vendors,
        importType: "attendees",
        targets: TARGETS,
        suggester: null,
      }),
    ).toMatchObject({ looksLike: "suppliers" });
    const model = suggester({
      ok: true,
      output: { looksLike: "suppliers", columns: [{ index: 0, field: "name" }] },
    });
    expect(
      await suggestColumns({
        table: vendors,
        importType: "attendees",
        targets: TARGETS,
        suggester: model,
      }),
    ).toMatchObject({ source: "ai", looksLike: "suppliers", mapping: ["name", null] });
  });
});

describe("mappingFromOutput", () => {
  it("leaves columns the model didn't mention as Don't import", () => {
    expect(
      mappingFromOutput(
        { looksLike: "attendees", columns: [{ index: 1, field: "name" }] },
        3,
        TARGETS.attendees,
      ),
    ).toEqual([null, "name", null]);
  });
});