// src/modules/events/suppliers/audit.test.ts
// Supplier, quote and payment entries in the audit log (B4-03, D-070; quotes B4-09, D-075;
// payments B4-14, D-077). The audit registry keeps its own copy of the
// category list and labels (it can't import this context); these tests keep them equal to the
// canonical definitions (D-069), check what each entry may hold, and how Activity words it.
import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTIONS,
  PAYMENT_KINDS as AUDIT_PAYMENT_KINDS,
  PAYMENT_KIND_LABEL,
  PAYMENT_RECORD_STATUSES as AUDIT_PAYMENT_RECORD_STATUSES,
  PAYMENT_RECORD_STATUS_LABEL,
  QUOTE_STATUSES as AUDIT_QUOTE_STATUSES,
  QUOTE_STATUS_LABEL,
  SUPPLIER_CATEGORIES as AUDIT_CATEGORIES,
  SUPPLIER_CATEGORY_LABEL,
  describeAuditEntry,
  formatAuditPeso,
} from "@/modules/events/audit/public";
import { SUPPLIER_CATEGORIES, SUPPLIER_CATEGORY_DEFINITIONS } from "./categories";
import { formatPeso } from "./money";
import {
  PAYMENT_KINDS,
  PAYMENT_KIND_DEFINITIONS,
  PAYMENT_RECORD_STATUSES,
  PAYMENT_RECORD_STATUS_DEFINITIONS,
} from "./payment-definitions";
import { QUOTE_STATUSES, QUOTE_STATUS_DEFINITIONS } from "./quote-statuses";

describe("the audit registry's copies", () => {
  it("list the same categories with the same labels", () => {
    expect([...AUDIT_CATEGORIES]).toEqual([...SUPPLIER_CATEGORIES]);
    for (const category of SUPPLIER_CATEGORIES) {
      expect(SUPPLIER_CATEGORY_LABEL[category]).toBe(SUPPLIER_CATEGORY_DEFINITIONS[category].label);
    }
  });

  it("list the same quote statuses with the same labels, and format pesos the same way", () => {
    expect([...AUDIT_QUOTE_STATUSES]).toEqual([...QUOTE_STATUSES]);
    for (const status of QUOTE_STATUSES) {
      expect(QUOTE_STATUS_LABEL[status]).toBe(QUOTE_STATUS_DEFINITIONS[status].label);
    }
    for (const amount of ["0.01", "999.00", "1000.00", "165000.50", "9999999999.99"]) {
      expect(formatAuditPeso(amount)).toBe(formatPeso(amount));
    }
  });

  it("list the same payment kinds and recorded statuses with the same labels", () => {
    expect([...AUDIT_PAYMENT_KINDS]).toEqual([...PAYMENT_KINDS]);
    expect([...AUDIT_PAYMENT_RECORD_STATUSES]).toEqual([...PAYMENT_RECORD_STATUSES]);
    for (const kind of PAYMENT_KINDS) {
      expect(PAYMENT_KIND_LABEL[kind]).toBe(PAYMENT_KIND_DEFINITIONS[kind].label);
    }
    for (const status of PAYMENT_RECORD_STATUSES) {
      expect(PAYMENT_RECORD_STATUS_LABEL[status]).toBe(
        PAYMENT_RECORD_STATUS_DEFINITIONS[status].label,
      );
    }
  });
});

describe("supplier.created", () => {
  const details = AUDIT_ACTIONS["supplier.created"].details;
  const entry = {
    reference: "SUP-0001",
    name: "Garden Kitchen",
    category: "CATERING",
    categoryDetail: null,
  };

  it("holds the readable ID, name and category only", () => {
    expect(details.parse(entry)).toEqual(entry);
    expect(details.safeParse({ ...entry, email: "liza@example.com" }).success).toBe(false);
    expect(details.safeParse({ ...entry, notes: "Tasting" }).success).toBe(false);
    expect(details.safeParse({ ...entry, reference: "ATT-0001" }).success).toBe(false);
    expect(details.safeParse({ ...entry, category: "DRONES" }).success).toBe(false);
  });

  it("reads plainly in Activity, with what an Other supplier provides", () => {
    expect(describeAuditEntry({ action: "supplier.created", details: entry })).toEqual({
      summary: "Added the supplier Garden Kitchen (SUP-0001): Catering",
      lines: [],
    });
    expect(
      describeAuditEntry({
        action: "supplier.created",
        details: {
          ...entry,
          name: "Sparkle Lights",
          category: "OTHER",
          categoryDetail: "Fireworks",
        },
      }).summary,
    ).toBe("Added the supplier Sparkle Lights (SUP-0001): Other: Fireworks");
  });
});

describe("supplier.updated", () => {
  const details = AUDIT_ACTIONS["supplier.updated"].details;

  it("holds the readable ID and changes only; contacts only as changed; never empty", () => {
    const entry = {
      reference: "SUP-0002",
      changes: { name: { from: "A", to: "B" }, email: { changed: true } },
    };
    expect(details.parse(entry)).toEqual(entry);
    expect(
      details.safeParse({
        reference: "SUP-0002",
        changes: { email: { from: "a@x.ph", to: "b@x.ph" } },
      }).success,
    ).toBe(false);
    expect(details.safeParse({ reference: "SUP-0002", changes: {} }).success).toBe(false);
    expect(
      details.safeParse({ reference: "SUP-0002", changes: { eventId: { changed: true } } }).success,
    ).toBe(false);
  });

  it("reads plainly in Activity", () => {
    expect(
      describeAuditEntry({
        action: "supplier.updated",
        details: {
          reference: "SUP-0002",
          changes: {
            name: { from: "Loud Studio", to: "Loud Studio PH" },
            category: {
              from: { category: "SOUND_AND_LIGHTS", detail: null },
              to: { category: "OTHER", detail: "LED walls" },
            },
            phone: { changed: true },
            notes: { changed: true },
          },
        },
      }),
    ).toEqual({
      summary: "Edited the supplier SUP-0002",
      lines: [
        "Name: “Loud Studio” → “Loud Studio PH”",
        "Category: Sound and lights → Other: LED walls",
        "Phone changed",
        "Notes changed",
      ],
    });
  });
});

describe("supplier.deleted", () => {
  const details = AUDIT_ACTIONS["supplier.deleted"].details;

  it("keeps the readable ID and name only", () => {
    const entry = { reference: "SUP-0003", name: "Bloom Co." };
    expect(details.parse(entry)).toEqual(entry);
    expect(details.safeParse({ ...entry, email: "hello@bloom.ph" }).success).toBe(false);
    expect(details.safeParse({ reference: "ATT-0003", name: "Bloom Co." }).success).toBe(false);
  });

  it("reads plainly in Activity", () => {
    expect(
      describeAuditEntry({
        action: "supplier.deleted",
        details: { reference: "SUP-0003", name: "Bloom Co." },
      }),
    ).toEqual({ summary: "Removed the supplier Bloom Co. (SUP-0003)", lines: [] });
  });
});

describe("quote.created", () => {
  const details = AUDIT_ACTIONS["quote.created"].details;
  const entry = {
    reference: "QUO-0002",
    supplierReference: "SUP-0001",
    amount: "165000.50",
    status: "ACCEPTED",
    description: "Buffet, 220 guests",
  };

  it("holds the quote and supplier IDs, a canonical amount, a canonical status and the description", () => {
    expect(details.parse(entry)).toEqual(entry);
    expect(details.parse({ ...entry, description: null })).toMatchObject({ description: null });
    for (const amount of ["165000.5", "165,000.50", "-1.00", "0165000.50", 165000.5]) {
      expect(details.safeParse({ ...entry, amount }).success).toBe(false);
    }
    expect(details.safeParse({ ...entry, status: "REJECTED" }).success).toBe(false);
    expect(details.safeParse({ ...entry, reference: "SUP-0002" }).success).toBe(false);
    expect(details.safeParse({ ...entry, email: "liza@example.com" }).success).toBe(false);
  });

  it("reads plainly in Activity, with the amount in pesos", () => {
    expect(describeAuditEntry({ action: "quote.created", details: entry })).toEqual({
      summary: "Added the quote QUO-0002 for SUP-0001: ₱165,000.50 (Accepted)",
      lines: ["Description: Buffet, 220 guests"],
    });
    expect(
      describeAuditEntry({ action: "quote.created", details: { ...entry, description: null } })
        .lines,
    ).toEqual([]);
  });
});

describe("quote.updated", () => {
  const details = AUDIT_ACTIONS["quote.updated"].details;

  it("holds the quote and supplier IDs and what changed; never empty, canonical values only", () => {
    const entry = {
      reference: "QUO-0001",
      supplierReference: "SUP-0001",
      changes: { amount: { from: "180000.00", to: "165000.50" } },
    };
    expect(details.parse(entry)).toEqual(entry);
    expect(details.safeParse({ ...entry, changes: {} }).success).toBe(false);
    expect(
      details.safeParse({ ...entry, changes: { amount: { from: "180000", to: "1" } } }).success,
    ).toBe(false);
    expect(
      details.safeParse({ ...entry, changes: { status: { from: "PENDING", to: "MAYBE" } } })
        .success,
    ).toBe(false);
    expect(
      details.safeParse({ ...entry, changes: { supplierId: { from: "a", to: "b" } } }).success,
    ).toBe(false);
  });

  it("reads plainly in Activity, with amounts in pesos and status labels", () => {
    expect(
      describeAuditEntry({
        action: "quote.updated",
        details: {
          reference: "QUO-0001",
          supplierReference: "SUP-0001",
          changes: {
            amount: { from: "180000.00", to: "165000.50" },
            status: { from: "PENDING", to: "ACCEPTED" },
            description: { from: null, to: "Buffet" },
          },
        },
      }),
    ).toEqual({
      summary: "Accepted the quote QUO-0001 for SUP-0001",
      lines: [
        "Amount: ₱180,000.00 → ₱165,000.50",
        "Status: Pending → Accepted",
        "Description: none → “Buffet”",
      ],
    });
  });
});

describe("payment.created", () => {
  const details = AUDIT_ACTIONS["payment.created"].details;
  const entry = {
    reference: "PAY-0001",
    supplierReference: "SUP-0001",
    kind: "DEPOSIT",
    amount: "49500.00",
    dueDate: "2026-10-05",
    status: "PAID",
    paidOn: "2026-10-03",
    description: "30% deposit",
  };

  it("holds business facts only, in canonical form", () => {
    expect(details.parse(entry)).toEqual(entry);
    expect(details.safeParse({ ...entry, amount: "49500" }).success).toBe(false);
    expect(details.safeParse({ ...entry, dueDate: "Oct 5, 2026" }).success).toBe(false);
    expect(details.safeParse({ ...entry, status: "OVERDUE" }).success).toBe(false);
    expect(details.safeParse({ ...entry, kind: "REFUND" }).success).toBe(false);
    expect(details.safeParse({ ...entry, email: "a@b.ph" }).success).toBe(false);
  });

  it("reads plainly in Activity", () => {
    expect(describeAuditEntry({ action: "payment.created", details: entry })).toEqual({
      summary: "Added the deposit PAY-0001 for SUP-0001: ₱49,500.00, due Oct 5, 2026",
      lines: ["Paid on Oct 3, 2026", "Description: 30% deposit"],
    });
    expect(
      describeAuditEntry({
        action: "payment.created",
        details: { ...entry, kind: "PAYMENT", status: "UNPAID", paidOn: null, description: null },
      }),
    ).toEqual({
      summary: "Added the payment PAY-0001 for SUP-0001: ₱49,500.00, due Oct 5, 2026",
      lines: ["Not paid yet"],
    });
  });
});

describe("payment.updated", () => {
  it("holds what changed, never empty, and reads plainly", () => {
    const details = AUDIT_ACTIONS["payment.updated"].details;
    const entry = {
      reference: "PAY-0003",
      supplierReference: "SUP-0002",
      changes: {
        dueDate: { from: "2026-10-10", to: "2026-10-20" },
        status: { from: "UNPAID", to: "PAID" },
        paidOn: { from: null, to: "2026-10-14" },
      },
    };
    expect(details.parse(entry)).toEqual(entry);
    expect(details.safeParse({ ...entry, changes: {} }).success).toBe(false);
    expect(describeAuditEntry({ action: "payment.updated", details: entry })).toEqual({
      summary: "Marked the payment PAY-0003 for SUP-0002 as paid (Oct 14, 2026)",
      lines: [
        "Due date: Oct 10, 2026 → Oct 20, 2026",
        "Status: Not paid yet → Paid",
        "Paid on: none → Oct 14, 2026",
      ],
    });
  });
});

describe("status changes lead the Activity summary (B4-20)", () => {
  const quote = (changes: Record<string, unknown>) =>
    describeAuditEntry({
      action: "quote.updated",
      details: { reference: "QUO-0002", supplierReference: "SUP-0001", changes },
    }).summary;
  const payment = (changes: Record<string, unknown>) =>
    describeAuditEntry({
      action: "payment.updated",
      details: { reference: "PAY-0002", supplierReference: "SUP-0001", changes },
    }).summary;

  it.each([
    [{ status: { from: "PENDING", to: "ACCEPTED" } }, "Accepted the quote QUO-0002 for SUP-0001"],
    [{ status: { from: "PENDING", to: "DECLINED" } }, "Declined the quote QUO-0002 for SUP-0001"],
    [
      { status: { from: "ACCEPTED", to: "PENDING" } },
      "Set the quote QUO-0002 for SUP-0001 back to Pending",
    ],
    [{ amount: { from: "1000.00", to: "2000.00" } }, "Edited the quote QUO-0002 for SUP-0001"],
  ])("quote %j", (changes, summary) => {
    expect(quote(changes)).toBe(summary);
  });

  it.each([
    [
      { status: { from: "UNPAID", to: "PAID" }, paidOn: { from: null, to: "2026-10-02" } },
      "Marked the payment PAY-0002 for SUP-0001 as paid (Oct 2, 2026)",
    ],
    [
      { status: { from: "PAID", to: "UNPAID" }, paidOn: { from: "2026-10-02", to: null } },
      "Marked the payment PAY-0002 for SUP-0001 as not paid yet",
    ],
    [{ amount: { from: "1000.00", to: "2000.00" } }, "Edited the payment PAY-0002 for SUP-0001"],
    [
      { paidOn: { from: "2026-10-02", to: "2026-10-03" } },
      "Edited the payment PAY-0002 for SUP-0001",
    ],
  ])("payment %j", (changes, summary) => {
    expect(payment(changes)).toBe(summary);
  });
});