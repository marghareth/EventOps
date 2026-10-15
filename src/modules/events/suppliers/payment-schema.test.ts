// src/modules/events/suppliers/payment-schema.test.ts
// Payment form validation (B4-14; D-077, D-079): canonical amounts and refusals, real calendar dates
// in range, a past due date allowed, the paid date required for Paid, never after today in Manila
// and dropped for Unpaid; canonical kinds and statuses; readable IDs; stored values round-trip
// through the edit form; what changed for Activity. The canonical lists equal the database enums.
import { describe, expect, it } from "vitest";
import {
  PaymentKind as DbPaymentKind,
  PaymentRecordStatus as DbPaymentRecordStatus,
} from "@/generated/prisma/enums";
import { PAYMENT_KINDS, PAYMENT_RECORD_STATUSES } from "./payment-definitions";
import {
  formatPaymentReference,
  isPaymentReference,
  paymentChanges,
  paymentFormSchema,
  toPaymentFormValues,
  type PaymentField,
  type PaymentInput,
} from "./payment-schema";

const TODAY = "2026-10-14";
const parse = (values: Partial<Record<PaymentField, string>>, today = TODAY) =>
  paymentFormSchema(today).safeParse({
    kind: "DEPOSIT",
    amount: "49,500",
    dueDate: "2026-11-15",
    status: "UNPAID",
    paidOn: "",
    description: "",
    ...values,
  });
const errorFor = (result: ReturnType<typeof parse>, field: string) =>
  result.success ? undefined : result.error.issues.find((i) => i.path[0] === field)?.message;

describe("the canonical payment lists", () => {
  it("equal the database enums", () => {
    expect([...PAYMENT_KINDS].sort()).toEqual(Object.values(DbPaymentKind).sort());
    expect([...PAYMENT_RECORD_STATUSES].sort()).toEqual(
      Object.values(DbPaymentRecordStatus).sort(),
    );
  });
});

describe("paymentFormSchema", () => {
  it("turns input into canonical strings, with no paid date for an unpaid payment", () => {
    expect(parse({ description: "  30%  deposit " })).toEqual({
      success: true,
      data: {
        kind: "DEPOSIT",
        amount: "49500.00",
        dueDate: "2026-11-15",
        status: "UNPAID",
        paidOn: null,
        description: "30% deposit",
      },
    });
  });

  it("keeps the paid date for a Paid payment, up to and including today", () => {
    for (const paidOn of ["2026-10-14", "2026-10-01", "2000-01-01"]) {
      expect(parse({ status: "PAID", paidOn })).toMatchObject({ success: true, data: { paidOn } });
    }
  });

  it("lists a missing paid date together with other problems (B4-23)", () => {
    const result = parse({ amount: "-5", dueDate: "", status: "PAID", paidOn: "" });
    expect(result.success ? [] : result.error.issues.map((i) => [i.path[0], i.message])).toEqual([
      ["amount", "Enter an amount more than ₱0."],
      ["dueDate", "Enter the due date."],
      ["paidOn", "Enter the day it was paid."],
    ]);
    // A paid date that is itself not a real date gets only its own message.
    const invalid = parse({ amount: "-5", status: "PAID", paidOn: "2026-02-30" });
    expect(errorFor(invalid, "paidOn")).toBe("Enter a real date, for example 2026-11-15.");
    expect(
      invalid.success ? 0 : invalid.error.issues.filter((i) => i.path[0] === "paidOn"),
    ).toHaveLength(1);
  });

  it("accepts the first and last days of the supported range (B4-21)", () => {
    for (const dueDate of ["2000-01-01", "2100-12-31"]) {
      expect(parse({ dueDate })).toMatchObject({ success: true, data: { dueDate } });
    }
    expect(parse({ status: "PAID", paidOn: "2100-12-31" }, "2100-12-31")).toMatchObject({
      success: true,
      data: { paidOn: "2100-12-31" },
    });
  });

  it("drops a paid date sent with an unpaid payment, so it is never stored", () => {
    expect(parse({ status: "UNPAID", paidOn: "2026-10-01" })).toMatchObject({
      success: true,
      data: { paidOn: null },
    });
  });

  it("allows a due date that has passed (it shows as overdue)", () => {
    expect(parse({ dueDate: "2026-10-01" }).success).toBe(true);
  });

  it.each([
    ["no amount", { amount: "" }, "amount", "Enter the amount."],
    ["a negative amount", { amount: "-100" }, "amount", "Enter an amount more than ₱0."],
    ["a zero amount", { amount: "0" }, "amount", "Enter an amount more than ₱0."],
    ["three decimals", { amount: "1.005" }, "amount", "Use at most two decimal places (centavos)."],
    [
      "an ambiguous amount",
      { amount: "1.000,00" },
      "amount",
      "Enter an amount in pesos, like 120000 or 120,000.50.",
    ],
    ["no due date", { dueDate: "" }, "dueDate", "Enter the due date."],
    [
      "an impossible due date",
      { dueDate: "2026-02-30" },
      "dueDate",
      "Enter a real date, for example 2026-11-15.",
    ],
    [
      "a due date in another format",
      { dueDate: "11/15/2026" },
      "dueDate",
      "Enter a real date, for example 2026-11-15.",
    ],
    [
      "a due date before 2000",
      { dueDate: "1999-12-31" },
      "dueDate",
      "Enter a date from Jan 1, 2000 to Dec 31, 2100.",
    ],
    [
      "a due date after 2100",
      { dueDate: "2101-01-01" },
      "dueDate",
      "Enter a date from Jan 1, 2000 to Dec 31, 2100.",
    ],
    [
      "Paid without a paid date",
      { status: "PAID", paidOn: "" },
      "paidOn",
      "Enter the day it was paid.",
    ],
    [
      "a paid date tomorrow",
      { status: "PAID", paidOn: "2026-10-15" },
      "paidOn",
      "The paid date can't be in the future.",
    ],
    [
      "an impossible paid date",
      { status: "PAID", paidOn: "2026-09-31" },
      "paidOn",
      "Enter a real date, for example 2026-11-15.",
    ],
    [
      "a paid date before 2000",
      { status: "PAID", paidOn: "1999-12-31" },
      "paidOn",
      "Enter a date from Jan 1, 2000 to Dec 31, 2100.",
    ],
    ["an unknown kind", { kind: "REFUND" }, "kind", "Choose deposit or payment."],
    ["an unknown status", { status: "OVERDUE" }, "status", "Choose whether it has been paid."],
    ["a lower-case status", { status: "paid" }, "status", "Choose whether it has been paid."],
    [
      "a description over 120 characters",
      { description: "d".repeat(121) },
      "description",
      "Use 120 characters or fewer.",
    ],
  ])("refuses %s, with a message on the field", (_label, values, field, message) => {
    expect(errorFor(parse(values), field)).toBe(message);
  });

  it("judges 'in the future' by the day it is given, not the browser's clock", () => {
    expect(parse({ status: "PAID", paidOn: "2026-10-15" }, "2026-10-15").success).toBe(true);
    expect(errorFor(parse({ status: "PAID", paidOn: "2026-10-15" }, "2026-10-14"), "paidOn")).toBe(
      "The paid date can't be in the future.",
    );
  });

  it("ignores fields the form doesn't have", () => {
    const result = paymentFormSchema(TODAY).safeParse({
      kind: "PAYMENT",
      amount: "1000",
      dueDate: "2026-12-01",
      status: "UNPAID",
      paidOn: "",
      description: "",
      supplierId: "someone-else",
      eventId: "another-event",
    });
    expect(result.success && Object.keys(result.data).sort()).toEqual([
      "amount",
      "description",
      "dueDate",
      "kind",
      "paidOn",
      "status",
    ]);
  });

  it("round-trips stored values through the edit form", () => {
    const stored: PaymentInput = {
      kind: "PAYMENT",
      amount: "115500.00",
      dueDate: "2026-12-05",
      status: "PAID",
      paidOn: "2026-10-10",
      description: "Balance",
    };
    expect(toPaymentFormValues(stored)).toEqual({
      kind: "PAYMENT",
      amount: "115,500.00",
      dueDate: "2026-12-05",
      status: "PAID",
      paidOn: "2026-10-10",
      description: "Balance",
    });
    expect(paymentFormSchema(TODAY).parse(toPaymentFormValues(stored))).toEqual(stored);
  });
});

describe("readable payment IDs and changes", () => {
  it("are PAY- and at least four digits, recognised only when well formed", () => {
    expect(formatPaymentReference(2)).toBe("PAY-0002");
    expect(isPaymentReference("PAY-0002")).toBe(true);
    for (const value of ["PAY-2", "QUO-0002", "pay-0002", "PAY-0002<b>", null]) {
      expect(isPaymentReference(value)).toBe(false);
    }
  });

  it("record what changed, old → new, and nothing when nothing changed", () => {
    const before: PaymentInput = {
      kind: "DEPOSIT",
      amount: "49500.00",
      dueDate: "2026-10-05",
      status: "UNPAID",
      paidOn: null,
      description: null,
    };
    expect(paymentChanges(before, { ...before })).toEqual({});
    expect(paymentChanges(before, { ...before, status: "PAID", paidOn: "2026-10-03" })).toEqual({
      status: { from: "UNPAID", to: "PAID" },
      paidOn: { from: null, to: "2026-10-03" },
    });
  });
});