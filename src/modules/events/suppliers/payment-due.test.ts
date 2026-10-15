// src/modules/events/suppliers/payment-due.test.ts
// Due and overdue rules (B4-15, D-079): due today, future, overdue and already-paid payments; paid
// payments are never overdue; Philippine calendar days at the midnight boundary (16:00 UTC); real
// calendar dates only; a supplier's next due payment; determinism.
import { describe, expect, it } from "vitest";
import {
  PAYMENT_DUE_STATUSES,
  PAYMENT_DUE_STATUS_DEFINITIONS,
  formatCalendarDate,
  isCalendarDate,
  manilaToday,
  paymentDueStatus,
  supplierDueSummary,
  toCalendarDate,
} from "./payment-due";

const unpaid = (dueDate: string) => ({ status: "UNPAID" as const, dueDate });
const paid = (dueDate: string) => ({ status: "PAID" as const, dueDate });

describe("the canonical due statuses", () => {
  it("are Overdue, Due today, Upcoming and Paid, each with a meaning", () => {
    expect(PAYMENT_DUE_STATUSES.map((s) => PAYMENT_DUE_STATUS_DEFINITIONS[s].label)).toEqual([
      "Overdue",
      "Due today",
      "Upcoming",
      "Paid",
    ]);
  });
});

describe("manilaToday", () => {
  it.each([
    ["2026-10-14T15:59:59.999Z", "2026-10-14"], // 23:59:59.999 in Manila
    ["2026-10-14T16:00:00.000Z", "2026-10-15"], // midnight in Manila
    ["2026-10-14T00:00:00.000Z", "2026-10-14"], // 08:00 in Manila
    ["2026-12-31T16:00:00.000Z", "2027-01-01"], // the new year arrives at 16:00 UTC
    ["2028-02-28T16:00:00.000Z", "2028-02-29"], // a leap day
  ])("is the Philippine calendar day at %s", (instant, day) => {
    expect(manilaToday(new Date(instant))).toBe(day);
  });
});

describe("paymentDueStatus", () => {
  const today = "2026-10-14";

  it.each([
    ["the day before", "2026-10-13", "OVERDUE"],
    ["long ago", "2000-01-01", "OVERDUE"],
    ["today", "2026-10-14", "DUE_TODAY"],
    ["the day after", "2026-10-15", "UPCOMING"],
    ["across a month end", "2026-11-01", "UPCOMING"],
  ] as const)("is %s for an unpaid payment due %s", (_name, dueDate, status) => {
    expect(paymentDueStatus(unpaid(dueDate), today)).toBe(status);
  });

  it.each(["2026-10-13", "2026-10-14", "2026-10-15", "2000-01-01"])(
    "is Paid, never Overdue, for a paid payment due %s",
    (dueDate) => {
      expect(paymentDueStatus(paid(dueDate), today)).toBe("PAID");
    },
  );

  it("turns Overdue exactly at midnight in Manila, not in UTC", () => {
    const payment = unpaid("2026-10-14");
    expect(paymentDueStatus(payment, manilaToday(new Date("2026-10-14T15:59:59.999Z")))).toBe(
      "DUE_TODAY",
    );
    expect(paymentDueStatus(payment, manilaToday(new Date("2026-10-14T16:00:00.000Z")))).toBe(
      "OVERDUE",
    );
    // 00:30 on the 14th in Manila is still the 13th in UTC: already due today, not upcoming.
    expect(paymentDueStatus(payment, manilaToday(new Date("2026-10-13T16:30:00.000Z")))).toBe(
      "DUE_TODAY",
    );
  });

  it("refuses dates that aren't real calendar dates", () => {
    for (const dueDate of ["2026-02-30", "2026-13-01", "2026-10-14T00:00", "14/10/2026", ""]) {
      expect(() => paymentDueStatus(unpaid(dueDate), today)).toThrow();
    }
  });
});

describe("calendar dates", () => {
  it("are real days written YYYY-MM-DD", () => {
    for (const value of ["2026-10-14", "2028-02-29", "2000-01-01", "2100-12-31"]) {
      expect(isCalendarDate(value)).toBe(true);
    }
    for (const value of ["2026-02-29", "2026-04-31", "2026-1-5", "2026-10-14 ", "20261014", ""]) {
      expect(isCalendarDate(value)).toBe(false);
    }
  });

  it("read as written, with no time zone shift", () => {
    expect(formatCalendarDate("2026-11-15")).toBe("Nov 15, 2026");
    expect(formatCalendarDate("2027-01-01")).toBe("Jan 1, 2027");
    expect(() => formatCalendarDate("2026-02-30")).toThrow();
  });

  it("come back from a DATE column unchanged", () => {
    expect(toCalendarDate(new Date("2026-11-15T00:00:00.000Z"))).toBe("2026-11-15");
  });
});

describe("supplierDueSummary", () => {
  const today = "2026-10-14";

  it("names the earliest unpaid payment and counts the overdue ones", () => {
    expect(
      supplierDueSummary(
        [unpaid("2026-11-30"), paid("2026-09-01"), unpaid("2026-10-01"), unpaid("2026-10-10")],
        today,
      ),
    ).toEqual({ overdueCount: 2, next: { dueDate: "2026-10-01", dueStatus: "OVERDUE" } });
  });

  it("has nothing due when every payment is paid, or there are none", () => {
    expect(supplierDueSummary([paid("2026-01-01")], today)).toEqual({
      overdueCount: 0,
      next: null,
    });
    expect(supplierDueSummary([], today)).toEqual({ overdueCount: 0, next: null });
  });

  it("says Due today and Upcoming without counting them as overdue", () => {
    expect(supplierDueSummary([unpaid("2026-10-20"), unpaid("2026-10-14")], today)).toEqual({
      overdueCount: 0,
      next: { dueDate: "2026-10-14", dueStatus: "DUE_TODAY" },
    });
  });

  it("is deterministic whatever the order", () => {
    const payments = [unpaid("2026-12-01"), unpaid("2026-10-02"), paid("2026-10-01")];
    expect(supplierDueSummary([...payments].reverse(), today)).toEqual(
      supplierDueSummary(payments, today),
    );
  });
});