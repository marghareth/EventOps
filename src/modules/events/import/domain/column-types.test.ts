// src/modules/events/import/domain/column-types.test.ts
// @vitest-environment node
// Data type detection (B9-F07, D-110): each value, then the column by majority.
import { describe, expect, it } from "vitest";
import { columnType, valueType } from "./column-types";

describe("valueType", () => {
  it.each([
    ["ana@example.com", "email"],
    [" Ana@Example.COM ", "email"],
    ["0917 123 4567", "phone"],
    ["+63 917 123 4567", "phone"],
    ["(032) 234-5678", "phone"],
    ["9171234567", "phone"],
    ["2026-10-25", "date"],
    ["25/10/2026", "date"],
    ["Oct 25, 2026", "date"],
    ["25 October 2026", "date"],
    ["2", "number"],
    ["1,200", "number"],
    ["350.50", "number"],
    ["1200000", "number"],
    ["Yes", "yesno"],
    ["n", "yesno"],
    ["TRUE", "yesno"],
    ["Ana Reyes", "text"],
    ["T1", "text"],
    ["not-an-email", "text"],
  ])("%j is %s", (value, type) => {
    expect(valueType(value)).toBe(type);
  });

  it("ignores empty values", () => {
    expect(valueType("  ")).toBeNull();
  });
});

describe("columnType", () => {
  it("takes the type more than half of the non-empty values share", () => {
    expect(columnType(["ana@x.co", "", "ben@x.co", "n/a"])).toBe("email");
    expect(columnType(["1", "0", "", "2"])).toBe("number");
  });

  it("is text when no type has a majority, and empty with no values", () => {
    expect(columnType(["ana@x.co", "0917 123 4567"])).toBe("text");
    expect(columnType(["", " "])).toBe("empty");
    expect(columnType([])).toBe("empty");
  });
});