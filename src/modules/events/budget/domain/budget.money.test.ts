// src/modules/events/budget/domain/budget.money.test.ts
import { describe, expect, it } from "vitest";
import { formatPesos, parsePesos } from "./budget.money";

describe("parsePesos", () => {
  it.each([
    ["0", "0.00"],
    ["1500", "1500.00"],
    ["1500.5", "1500.50"],
    ["1500.55", "1500.55"],
    ["1,500.50", "1500.50"],
    ["₱ 1,500", "1500.00"],
    ["  007.10 ", "7.10"],
    ["9999999999.99", "9999999999.99"],
  ])("accepts %s as %s", (raw, expected) => {
    expect(parsePesos(raw)).toEqual({ ok: true, value: expected });
  });

  it("refuses blank input", () => {
    expect(parsePesos("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it.each(["-1", "-0.50", "- 5"])("refuses the negative amount %s", (raw) => {
    expect(parsePesos(raw)).toEqual({ ok: false, reason: "negative" });
  });

  it.each(["abc", "1.234", "1.", ".5", "1,50", "12,34,567", "1e3", "1 000"])(
    "refuses the malformed amount %s without rounding it",
    (raw) => {
      expect(parsePesos(raw)).toEqual({ ok: false, reason: "format" });
    },
  );

  it("refuses more than the column holds", () => {
    expect(parsePesos("10000000000")).toEqual({ ok: false, reason: "too-large" });
  });
});

describe("formatPesos", () => {
  it.each([
    ["0.00", "₱0.00"],
    ["999.00", "₱999.00"],
    ["1000.00", "₱1,000.00"],
    ["1234567.80", "₱1,234,567.80"],
    ["9999999999.99", "₱9,999,999,999.99"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatPesos(value)).toBe(expected);
  });
});