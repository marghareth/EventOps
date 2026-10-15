// src/modules/events/suppliers/money.test.ts
// Peso amounts (B4-08, D-075): what a person may type, the canonical stored form, refusals with a
// clear message (negative, zero, more than two decimals, too large, ambiguous formats), and display.
// No floating point anywhere: every case goes through strings.
import { describe, expect, it } from "vitest";
import {
  MAX_PESO_AMOUNT,
  formatPeso,
  fromCentavos,
  isCanonicalPesoAmount,
  parsePesoAmount,
  toCentavos,
  toPesoInput,
} from "./money";

describe("parsePesoAmount", () => {
  it.each([
    ["120000", "120000.00"],
    ["120,000", "120000.00"],
    ["120,000.50", "120000.50"],
    ["120000.5", "120000.50"],
    ["1,234,567.89", "1234567.89"],
    ["  ₱ 45,000 ", "45000.00"],
    ["₱0.01", "0.01"],
    ["007", "7.00"],
    ["0.10", "0.10"],
    ["9,999,999,999.99", "9999999999.99"],
  ])("reads %j as %j", (input, value) => {
    expect(parsePesoAmount(input)).toEqual({ ok: true, value });
  });

  it.each([
    ["", "Enter the amount."],
    ["   ", "Enter the amount."],
    ["-500", "Enter an amount more than ₱0."],
    ["−500", "Enter an amount more than ₱0."],
    ["0", "Enter an amount more than ₱0."],
    ["0.00", "Enter an amount more than ₱0."],
    ["₱0", "Enter an amount more than ₱0."],
    ["120000.505", "Use at most two decimal places (centavos)."],
    ["0.001", "Use at most two decimal places (centavos)."],
    ["10000000000", "Enter an amount up to ₱9,999,999,999.99."],
    ["10,000,000,000.00", "Enter an amount up to ₱9,999,999,999.99."],
  ])("refuses %j: %s", (input, message) => {
    expect(parsePesoAmount(input)).toEqual({ ok: false, message });
  });

  it.each([
    "1.000,00",
    "1,20,000",
    "12,0000",
    "120 000",
    "1e5",
    "0x10",
    "Infinity",
    "NaN",
    "10-20k",
    "120k",
    "PHP 120000",
    "$120",
    "+120",
    ".50",
    "1,000.",
    "18500.",
    "١٢٠",
  ])("refuses the ambiguous %j", (input) => {
    expect(parsePesoAmount(input)).toEqual({
      ok: false,
      message: "Enter an amount in pesos, like 120000 or 120,000.50.",
    });
  });
});

describe("canonical amounts", () => {
  it("are what the parser produces and the database returns", () => {
    for (const value of ["0.01", "120000.50", MAX_PESO_AMOUNT]) {
      expect(isCanonicalPesoAmount(value)).toBe(true);
    }
    for (const value of ["120000", "120000.5", "0120.00", "1,000.00", "-1.00", "12345678901.00"]) {
      expect(isCanonicalPesoAmount(value)).toBe(false);
    }
  });

  it("display with the peso sign and grouped thousands, and round-trip through the form", () => {
    expect(formatPeso("120000.50")).toBe("₱120,000.50");
    expect(formatPeso("0.01")).toBe("₱0.01");
    expect(formatPeso("999.00")).toBe("₱999.00");
    expect(formatPeso(MAX_PESO_AMOUNT)).toBe("₱9,999,999,999.99");
    for (const value of ["0.01", "1000.00", "120000.50", MAX_PESO_AMOUNT]) {
      expect(parsePesoAmount(toPesoInput(value))).toEqual({ ok: true, value });
    }
  });
});

describe("centavos (B4-13)", () => {
  it("convert canonical amounts exactly, both ways", () => {
    expect(toCentavos("120000.50")).toBe(BigInt(12000050));
    expect(toCentavos("0.01")).toBe(BigInt(1));
    expect(toCentavos(MAX_PESO_AMOUNT)).toBe(BigInt(999999999999));
    expect(fromCentavos(BigInt(12000050))).toBe("120000.50");
    expect(fromCentavos(BigInt(0))).toBe("0.00");
    expect(fromCentavos(BigInt(5))).toBe("0.05");
    // Sums stay exact where floating point would not (0.1 + 0.2).
    expect(fromCentavos(toCentavos("0.10") + toCentavos("0.20"))).toBe("0.30");
    // Far beyond Decimal(12, 2), still exact.
    expect(fromCentavos(toCentavos(MAX_PESO_AMOUNT) * BigInt(1000))).toBe("9999999999990.00");
  });

  it("refuse anything that isn't canonical or is negative", () => {
    for (const value of ["120000", "1,000.00", "-1.00", "0.5", ""]) {
      expect(() => toCentavos(value)).toThrow();
    }
    expect(() => fromCentavos(-BigInt(1))).toThrow();
  });
});