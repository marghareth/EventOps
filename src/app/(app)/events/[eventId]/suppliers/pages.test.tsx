// src/app/(app)/events/[eventId]/suppliers/pages.test.tsx
// The supplier list, Add supplier (B4-03), Edit supplier (B4-04, with Remove B4-05) and supplier
// detail (B4-07, with quotes B4-09 and payments B4-14), Add and Edit quote (B4-09, B4-10) and Add
// and Edit payment (B4-14) pages: access checked by each
// page; the list for every member with empty, refused and notice states; Add and Edit for Owners and
// Coordinators only (a Viewer gets no form and nothing is loaded); notices read only from well-formed
// references, with the name from the stored supplier.
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireEventAccess = vi.fn();
const getEventSuppliers = vi.fn();
const getSupplierForEditing = vi.fn();
const getSupplierDetail = vi.fn();
const getQuoteForEditing = vi.fn();
const getPaymentFormContext = vi.fn();

vi.mock("@/modules/events/access", () => ({
  requireEventAccess: (...args: unknown[]) => requireEventAccess(...args),
  getEventAccess: vi.fn(),
}));
vi.mock("@/modules/events/actions", () => ({
  createEventAction: vi.fn(),
  updateEventAction: vi.fn(),
  deleteEventAction: vi.fn(),
}));
vi.mock("@/modules/events/queries", () => ({ getMyEvents: vi.fn() }));
vi.mock("@/modules/events/suppliers/read", () => ({
  getEventSuppliers: (...args: unknown[]) => getEventSuppliers(...args),
  getSupplierForEditing: (...args: unknown[]) => getSupplierForEditing(...args),
  getSupplierDetail: (...args: unknown[]) => getSupplierDetail(...args),
  getQuoteForEditing: (...args: unknown[]) => getQuoteForEditing(...args),
  getPaymentFormContext: (...args: unknown[]) => getPaymentFormContext(...args),
  SUPPLIER_ACTIVITY_LIMIT: 10,
}));
const updateBind = vi.fn(() => () => undefined);
const deleteBind = vi.fn(() => () => undefined);
const createQuoteBind = vi.fn(() => () => undefined);
const updateQuoteBind = vi.fn(() => () => undefined);
const createPaymentBind = vi.fn(() => () => undefined);
const updatePaymentBind = vi.fn(() => () => undefined);
vi.mock("@/modules/events/suppliers/payment-actions", () => ({
  createPaymentAction: { bind: (...args: unknown[]) => createPaymentBind(...(args as [])) },
  updatePaymentAction: { bind: (...args: unknown[]) => updatePaymentBind(...(args as [])) },
}));
vi.mock("@/modules/events/suppliers/quote-actions", () => ({
  createQuoteAction: { bind: (...args: unknown[]) => createQuoteBind(...(args as [])) },
  updateQuoteAction: { bind: (...args: unknown[]) => updateQuoteBind(...(args as [])) },
}));
vi.mock("@/modules/events/suppliers/actions", () => ({
  createSupplierAction: { bind: () => () => undefined },
  updateSupplierAction: { bind: (...args: unknown[]) => updateBind(...(args as [])) },
  deleteSupplierAction: { bind: (...args: unknown[]) => deleteBind(...(args as [])) },
}));

const { default: SuppliersPage } = await import("./page");
const { default: AddSupplierPage } = await import("./new/page");
const { default: EditSupplierPage } = await import("./[supplierId]/edit/page");
const { default: SupplierPage } = await import("./[supplierId]/page");
const { default: AddQuotePage } = await import("./[supplierId]/quotes/new/page");
const { default: EditQuotePage } = await import("./[supplierId]/quotes/[quoteId]/edit/page");
const { default: AddPaymentPage } = await import("./[supplierId]/payments/new/page");
const { default: EditPaymentPage } = await import("./[supplierId]/payments/[paymentId]/edit/page");

const ID = "3f2c1b8e-9a4d-4c1e-8b2a-6d5f4e3c2b1a";
const access = (role: "OWNER" | "COORDINATOR" | "VIEWER") =>
  requireEventAccess.mockResolvedValue({
    user: { id: "u1" },
    access: { kind: "ok", event: { id: ID, name: "Santos wedding", role } },
  });
/** The supplier list's money overview (B4-16): nothing accepted, nothing due. */
const overview = {
  acceptedQuote: null,
  pendingQuotes: 0,
  paymentStatus: "NO_ACCEPTED_QUOTE",
  due: { overdueCount: 0, next: null },
};
const garden = {
  id: "s1",
  number: 1,
  name: "Garden Kitchen",
  category: "CATERING",
  categoryDetail: null,
  contactName: "Liza Tan",
  email: "liza@gardenkitchen.ph",
  phone: "0917 555 0101",
  notes: null,
  updatedAt: new Date("2026-10-14T04:00:00Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Suppliers page", () => {
  const renderPage = async (search: Record<string, string> = {}) =>
    render(
      await SuppliersPage({
        params: Promise.resolve({ eventId: ID }),
        searchParams: Promise.resolve(search),
      }),
    );

  it.each([
    ["OWNER", true],
    ["COORDINATOR", true],
    ["VIEWER", false],
  ] as const)("lists suppliers for a %s (add: %s)", async (role, canManage) => {
    access(role);
    getEventSuppliers.mockResolvedValue({
      ok: true,
      suppliers: [{ ...garden, overview }],
      total: 1,
      canManage,
    });
    await renderPage();
    expect(requireEventAccess).toHaveBeenCalledWith(ID);
    expect(getEventSuppliers).toHaveBeenCalledWith(ID, {
      search: null,
      category: null,
      quote: null,
      payment: null,
      overdue: false,
    });
    expect(screen.getByRole("heading", { level: 1, name: "Suppliers" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 3, name: "Garden Kitchen" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Add supplier" }) !== null).toBe(canManage);
  });

  it.each([
    [true, "Add your first supplier, for example the venue or the caterer."],
    [false, "Owners and Coordinators can add suppliers to this event."],
  ])("explains an empty list (manager: %s)", async (canManage, text) => {
    access(canManage ? "OWNER" : "VIEWER");
    getEventSuppliers.mockResolvedValue({ ok: true, suppliers: [], total: 0, canManage });
    await renderPage();
    expect(screen.getByRole("heading", { name: "No suppliers yet" })).toBeVisible();
    expect(screen.getByText(text)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Add the first supplier" }) !== null).toBe(canManage);
  });

  it("confirms an added supplier by its stored name, ignoring forged values", async () => {
    access("OWNER");
    getEventSuppliers.mockResolvedValue({
      ok: true,
      suppliers: [{ ...garden, overview }],
      total: 1,
      canManage: true,
    });
    await renderPage({ added: "SUP-0001" });
    expect(screen.getByText("Supplier added")).toBeVisible();
    expect(screen.getByText(/Garden Kitchen is on the supplier list as/)).toBeVisible();
    document.body.innerHTML = "";
    await renderPage({ added: "<b>hacked</b>" });
    expect(screen.queryByText("Supplier added")).not.toBeInTheDocument();
  });

  it("confirms saved changes by the stored name", async () => {
    access("COORDINATOR");
    getEventSuppliers.mockResolvedValue({
      ok: true,
      suppliers: [{ ...garden, overview }],
      total: 1,
      canManage: true,
    });
    await renderPage({ saved: "SUP-0001" });
    expect(screen.getByText("Changes saved")).toBeVisible();
    expect(screen.getByText(/Garden Kitchen \(/)).toHaveTextContent(
      "Garden Kitchen (SUP-0001) is up to date.",
    );
  });

  it("confirms a removal by the reference only, as the supplier is gone", async () => {
    access("OWNER");
    getEventSuppliers.mockResolvedValue({ ok: true, suppliers: [], total: 0, canManage: true });
    await renderPage({ removed: "SUP-0001" });
    expect(screen.getByText("Supplier removed")).toBeVisible();
    expect(screen.getByText(/is no longer on the supplier list/)).toHaveTextContent(
      "SUP-0001 is no longer on the supplier list.",
    );
  });

  it("shows each supplier's accepted quote, payment status and next due date (B4-16)", async () => {
    access("VIEWER");
    getEventSuppliers.mockResolvedValue({
      ok: true,
      canManage: false,
      total: 1,
      suppliers: [
        {
          ...garden,
          overview: {
            acceptedQuote: "165000.00",
            pendingQuotes: 0,
            paymentStatus: "PARTIALLY_PAID",
            due: { overdueCount: 1, next: { dueDate: "2026-10-10", dueStatus: "OVERDUE" } },
          },
        },
      ],
    });
    await renderPage();
    const card = screen.getByRole("listitem");
    expect(card).toHaveTextContent("₱165,000.00 accepted");
    expect(card).toHaveTextContent("Partially paid");
    expect(card).toHaveTextContent("Oct 10, 2026Overdue");
  });

  it("links each supplier to its edit page for managers only", async () => {
    access("OWNER");
    getEventSuppliers.mockResolvedValue({
      ok: true,
      suppliers: [{ ...garden, overview }],
      total: 1,
      canManage: true,
    });
    await renderPage();
    expect(screen.getByRole("link", { name: "Edit Garden Kitchen (SUP-0001)" })).toHaveAttribute(
      "href",
      `/events/${ID}/suppliers/s1/edit`,
    );
    document.body.innerHTML = "";
    access("VIEWER");
    getEventSuppliers.mockResolvedValue({
      ok: true,
      suppliers: [{ ...garden, overview }],
      total: 1,
      canManage: false,
    });
    await renderPage();
    expect(screen.queryByRole("link", { name: /^Edit / })).not.toBeInTheDocument();
  });

  it("searches on the server with the cleaned text from the address (B4-17)", async () => {
    access("VIEWER");
    getEventSuppliers.mockResolvedValue({
      ok: true,
      suppliers: [{ ...garden, overview }],
      total: 4,
      canManage: false,
    });
    await renderPage({ q: "  kitchen\u0000 " });
    expect(getEventSuppliers).toHaveBeenCalledWith(ID, {
      search: "kitchen",
      category: null,
      quote: null,
      payment: null,
      overdue: false,
    });
    const form = screen.getByRole("search", { name: "Find suppliers" });
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByRole("searchbox", { name: "Search suppliers" })).toHaveValue("kitchen");
    expect(screen.getByRole("status")).toHaveTextContent("1 of 4 suppliers match.");
    expect(screen.getByRole("link", { name: "Clear search and filters" })).toHaveAttribute(
      "href",
      `/events/${ID}/suppliers`,
    );
  });

  it("says clearly when nothing matches, and how to see everyone again", async () => {
    access("OWNER");
    getEventSuppliers.mockResolvedValue({ ok: true, suppliers: [], total: 4, canManage: true });
    await renderPage({ q: "drones" });
    expect(screen.getByRole("heading", { name: "No suppliers match" })).toBeVisible();
    expect(
      screen.getByText(
        /Search: “drones”\. Change the search or filters, or clear them to see all 4 suppliers\./,
      ),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "No suppliers yet" })).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Clear search and filters" }).length,
    ).toBeGreaterThan(0);
  });

  it("reads filters from the address and keeps them in the form (B4-18)", async () => {
    access("VIEWER");
    getEventSuppliers.mockResolvedValue({ ok: true, suppliers: [], total: 3, canManage: false });
    await renderPage({
      category: "CATERING",
      quote: "accepted",
      payment: "partially-paid",
      overdue: "yes",
      eventId: "another-event",
    });
    expect(getEventSuppliers).toHaveBeenCalledWith(ID, {
      search: null,
      category: "CATERING",
      quote: "accepted",
      payment: "PARTIALLY_PAID",
      overdue: true,
    });
    expect(screen.getByLabelText("Category")).toHaveValue("CATERING");
    expect(screen.getByLabelText("Quote")).toHaveValue("accepted");
    expect(screen.getByLabelText("Payment status")).toHaveValue("partially-paid");
    expect(screen.getByLabelText("Only suppliers with an overdue payment")).toBeChecked();
    expect(
      screen.getByText(
        /Category: Catering · Quote: Quote accepted · Payment: Partially paid · Overdue payments only\./,
      ),
    ).toBeVisible();
  });

  it("shows no search box and no count when the event has no suppliers", async () => {
    access("OWNER");
    getEventSuppliers.mockResolvedValue({ ok: true, suppliers: [], total: 0, canManage: true });
    await renderPage();
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("is not found for a non-member, and loads nothing", async () => {
    requireEventAccess.mockRejectedValue(
      Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }),
    );
    await expect(renderPage()).rejects.toMatchObject({ notFound: true });
    expect(getEventSuppliers).not.toHaveBeenCalled();
  });
});

describe("Add supplier page", () => {
  const renderPage = async () =>
    render(await AddSupplierPage({ params: Promise.resolve({ eventId: ID }) }));

  it.each(["OWNER", "COORDINATOR"] as const)("gives a %s the form", async (role) => {
    access(role);
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Add a supplier" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Add supplier" })).toBeVisible();
  });

  it("refuses a Viewer, with no form", async () => {
    access("VIEWER");
    await renderPage();
    expect(screen.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add supplier" })).not.toBeInTheDocument();
  });
});

describe("Edit supplier page", () => {
  const renderPage = async (supplierId = "s1") =>
    render(await EditSupplierPage({ params: Promise.resolve({ eventId: ID, supplierId }) }));

  it.each(["OWNER", "COORDINATOR"] as const)(
    "gives a %s the form with the stored values and the version",
    async (role) => {
      access(role);
      getSupplierForEditing.mockResolvedValue({ ok: true, supplier: garden });
      const { container } = await renderPage();
      expect(getSupplierForEditing).toHaveBeenCalledWith(ID, "s1");
      expect(updateBind).toHaveBeenCalledWith(null, ID, "s1");
      expect(screen.getByRole("heading", { level: 1, name: "Edit Garden Kitchen" })).toBeVisible();
      expect(screen.getByText("SUP-0001", { selector: "p" })).toBeVisible();
      expect(screen.getByLabelText(/^Name/)).toHaveValue("Garden Kitchen");
      expect(screen.getByLabelText(/^Email/)).toHaveValue("liza@gardenkitchen.ph");
      expect(container.querySelector('input[name="version"]')).toHaveValue(
        "2026-10-14T04:00:00.000Z",
      );
      expect(deleteBind).toHaveBeenCalledWith(null, ID, "s1");
      expect(screen.getByRole("heading", { level: 2, name: "Remove supplier" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Remove supplier" })).toBeVisible();
    },
  );

  it("refuses a Viewer, loading nothing", async () => {
    access("VIEWER");
    await renderPage();
    expect(screen.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    expect(getSupplierForEditing).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove supplier" })).not.toBeInTheDocument();
  });

  it("is not found for an unknown supplier or another event's supplier", async () => {
    access("OWNER");
    getSupplierForEditing.mockResolvedValue({ ok: false, reason: "not-found" });
    // notFound() throws Next's not-found error.
    await expect(renderPage("other")).rejects.toMatchObject({
      digest: expect.stringMatching(/404|NOT_FOUND/),
    });
  });
});

const accepted = {
  id: "q2",
  supplierId: "s1",
  number: 2,
  amount: "165000.50",
  status: "ACCEPTED",
  description: "Buffet, 220 guests",
  statusChangedAt: new Date("2026-10-14T04:00:00Z"),
  createdAt: new Date("2026-10-14T04:00:00Z"),
  updatedAt: new Date("2026-10-14T04:00:00Z"),
};

const overdue = {
  id: "p2",
  supplierId: "s1",
  number: 2,
  kind: "PAYMENT",
  amount: "115500.00",
  dueDate: "2026-10-10",
  status: "UNPAID",
  paidOn: null,
  description: "Balance",
  createdAt: new Date("2026-10-14T04:00:00Z"),
  updatedAt: new Date("2026-10-14T04:00:00Z"),
  dueStatus: "OVERDUE",
};
const paymentData = {
  payments: [overdue],
  paymentSummary: { status: "UNPAID", committed: "165000.50", paid: "0.00", overpaidBy: null },
  dueSummary: { overdueCount: 1, next: { dueDate: "2026-10-10", dueStatus: "OVERDUE" } },
};

describe("Supplier detail page", () => {
  const renderPage = async (supplierId = "s1", search: Record<string, string> = {}) =>
    render(
      await SupplierPage({
        params: Promise.resolve({ eventId: ID, supplierId }),
        searchParams: Promise.resolve(search),
      }),
    );
  const entry = {
    id: "a1",
    createdAt: new Date("2026-10-14T04:00:00Z"),
    actorName: "Mika",
    action: "supplier.created",
    details: {
      reference: "SUP-0001",
      name: "Garden Kitchen",
      category: "CATERING",
      categoryDetail: null,
    },
  };

  it("shows an Owner the identity, contacts, Edit and recent activity", async () => {
    access("OWNER");
    getSupplierDetail.mockResolvedValue({
      ok: true,
      supplier: garden,
      quotes: [accepted],
      ...paymentData,
      canManage: true,
      activity: [entry],
    });
    await renderPage();
    expect(getSupplierDetail).toHaveBeenCalledWith(ID, "s1");
    expect(screen.getByRole("heading", { level: 1, name: "Garden Kitchen" })).toBeVisible();
    expect(screen.getByText("SUP-0001")).toBeVisible();
    expect(screen.getByText("Catering")).toBeVisible();
    expect(screen.getByRole("link", { name: "liza@gardenkitchen.ph" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Edit supplier" })).toHaveAttribute(
      "href",
      `/events/${ID}/suppliers/s1/edit`,
    );
    const quotes = screen.getByRole("region", { name: "Quotes" });
    expect(quotes).toHaveTextContent("QUO-0002");
    expect(quotes).toHaveTextContent("₱165,000.50");
    expect(quotes).toHaveTextContent("Accepted");
    expect(screen.getByRole("link", { name: "Add quote" })).toHaveAttribute(
      "href",
      `/events/${ID}/suppliers/s1/quotes/new`,
    );
    const payments = screen.getByRole("region", { name: "Deposits and payments" });
    expect(payments).toHaveTextContent("Payment status: Unpaid");
    expect(payments).toHaveTextContent("1 payment is overdue.");
    expect(payments).toHaveTextContent("Due status: Overdue");
    expect(screen.getByRole("link", { name: "Edit PAY-0002" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Recent activity" })).toHaveTextContent(
      "Added the supplier Garden Kitchen (SUP-0001): Catering",
    );
    expect(screen.getByRole("link", { name: "Back to suppliers" })).toHaveAttribute(
      "href",
      `/events/${ID}/suppliers`,
    );
  });

  it("lets a Viewer inspect identity and contacts, with no Edit and no activity", async () => {
    access("VIEWER");
    getSupplierDetail.mockResolvedValue({
      ok: true,
      supplier: garden,
      quotes: [accepted],
      ...paymentData,
      canManage: false,
      activity: null,
    });
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Garden Kitchen" })).toBeVisible();
    expect(screen.getByRole("link", { name: "0917 555 0101" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Edit supplier" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Recent activity" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Quotes" })).toHaveTextContent("₱165,000.50");
    expect(screen.queryByRole("link", { name: "Add quote" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Deposits and payments" })).toHaveTextContent(
      "₱115,500.00",
    );
    expect(screen.queryByRole("link", { name: "Add payment" })).not.toBeInTheDocument();
  });

  it("confirms an added quote by a well-formed reference only", async () => {
    access("OWNER");
    getSupplierDetail.mockResolvedValue({
      ok: true,
      supplier: garden,
      quotes: [accepted],
      ...paymentData,
      canManage: true,
      activity: [],
    });
    await renderPage("s1", { quoteAdded: "QUO-0002" });
    expect(screen.getByText("Quote added")).toBeVisible();
    document.body.innerHTML = "";
    await renderPage("s1", { quoteAdded: "<b>QUO-0002</b>" });
    expect(screen.queryByText("Quote added")).not.toBeInTheDocument();
    document.body.innerHTML = "";
    await renderPage("s1", { paymentAdded: "PAY-0002" });
    expect(screen.getByText("Payment added")).toBeVisible();
    document.body.innerHTML = "";
    await renderPage("s1", { paymentSaved: "PAY-<0002>" });
    expect(screen.queryByText("Payment saved")).not.toBeInTheDocument();
    document.body.innerHTML = "";
    await renderPage("s1", { quoteSaved: "QUO-0002" });
    expect(screen.getByText("Quote saved")).toBeVisible();
    expect(screen.getByText(/is up to date\./)).toHaveTextContent("QUO-0002 is up to date.");
  });

  it("is not found for an unknown supplier or another event's supplier", async () => {
    access("OWNER");
    getSupplierDetail.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(renderPage("other")).rejects.toMatchObject({
      digest: expect.stringMatching(/404|NOT_FOUND/),
    });
  });

  it("is not found for a non-member, and loads nothing", async () => {
    requireEventAccess.mockRejectedValue(
      Object.assign(new Error("NEXT_NOT_FOUND"), { notFound: true }),
    );
    await expect(renderPage()).rejects.toMatchObject({ notFound: true });
    expect(getSupplierDetail).not.toHaveBeenCalled();
  });
});

describe("Add quote page", () => {
  const renderPage = async (supplierId = "s1") =>
    render(await AddQuotePage({ params: Promise.resolve({ eventId: ID, supplierId }) }));

  it.each(["OWNER", "COORDINATOR"] as const)(
    "gives a %s the form for this supplier",
    async (role) => {
      access(role);
      getSupplierForEditing.mockResolvedValue({ ok: true, supplier: garden });
      await renderPage();
      expect(getSupplierForEditing).toHaveBeenCalledWith(ID, "s1");
      expect(createQuoteBind).toHaveBeenCalledWith(null, ID, "s1");
      expect(
        screen.getByRole("heading", { level: 1, name: "Add a quote from Garden Kitchen" }),
      ).toBeVisible();
      expect(screen.getByRole("button", { name: "Add quote" })).toBeVisible();
      expect(screen.getByRole("link", { name: "Back to Garden Kitchen" })).toHaveAttribute(
        "href",
        `/events/${ID}/suppliers/s1`,
      );
    },
  );

  it("refuses a Viewer, loading nothing", async () => {
    access("VIEWER");
    await renderPage();
    expect(screen.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    expect(getSupplierForEditing).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add quote" })).not.toBeInTheDocument();
  });

  it("is not found for an unknown supplier or another event's supplier", async () => {
    access("OWNER");
    getSupplierForEditing.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(renderPage("other")).rejects.toMatchObject({
      digest: expect.stringMatching(/404|NOT_FOUND/),
    });
  });
});

describe("Edit quote page", () => {
  const renderPage = async (quoteId = "q2") =>
    render(
      await EditQuotePage({ params: Promise.resolve({ eventId: ID, supplierId: "s1", quoteId }) }),
    );

  it.each(["OWNER", "COORDINATOR"] as const)(
    "gives a %s the form with the stored values and the version",
    async (role) => {
      access(role);
      getQuoteForEditing.mockResolvedValue({ ok: true, supplier: garden, quote: accepted });
      const { container } = await renderPage();
      expect(getQuoteForEditing).toHaveBeenCalledWith(ID, "s1", "q2");
      expect(updateQuoteBind).toHaveBeenCalledWith(null, ID, "s1", "q2");
      expect(
        screen.getByRole("heading", { level: 1, name: "Edit a quote from Garden Kitchen" }),
      ).toBeVisible();
      expect(screen.getByText("QUO-0002")).toBeVisible();
      expect(screen.getByLabelText(/^Amount/)).toHaveValue("165,000.50");
      expect(screen.getByLabelText(/^Status/)).toHaveValue("ACCEPTED");
      expect(container.querySelector('input[name="version"]')).toHaveValue(
        "2026-10-14T04:00:00.000Z",
      );
    },
  );

  it("refuses a Viewer, loading nothing", async () => {
    access("VIEWER");
    await renderPage();
    expect(screen.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    expect(getQuoteForEditing).not.toHaveBeenCalled();
  });

  it("is not found for an unknown quote, or another event's or supplier's quote", async () => {
    access("OWNER");
    getQuoteForEditing.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(renderPage("other")).rejects.toMatchObject({
      digest: expect.stringMatching(/404|NOT_FOUND/),
    });
  });
});

describe("Add and Edit payment pages", () => {
  const stored = { ...overdue, dueStatus: undefined };

  it.each(["OWNER", "COORDINATOR"] as const)(
    "give a %s the add form with today's limit",
    async (role) => {
      access(role);
      getPaymentFormContext.mockResolvedValue({
        ok: true,
        supplier: garden,
        payment: null,
        today: "2026-10-14",
      });
      render(await AddPaymentPage({ params: Promise.resolve({ eventId: ID, supplierId: "s1" }) }));
      expect(getPaymentFormContext).toHaveBeenCalledWith(ID, "s1", null);
      expect(createPaymentBind).toHaveBeenCalledWith(null, ID, "s1");
      expect(
        screen.getByRole("heading", { level: 1, name: "Add a payment to Garden Kitchen" }),
      ).toBeVisible();
      expect(screen.getByRole("button", { name: "Add payment" })).toBeVisible();
    },
  );

  it("gives an Owner the edit form with the stored values and the version", async () => {
    access("OWNER");
    getPaymentFormContext.mockResolvedValue({
      ok: true,
      supplier: garden,
      payment: stored,
      today: "2026-10-14",
    });
    const { container } = render(
      await EditPaymentPage({
        params: Promise.resolve({ eventId: ID, supplierId: "s1", paymentId: "p2" }),
      }),
    );
    expect(getPaymentFormContext).toHaveBeenCalledWith(ID, "s1", "p2");
    expect(updatePaymentBind).toHaveBeenCalledWith(null, ID, "s1", "p2");
    expect(screen.getByText("PAY-0002")).toBeVisible();
    expect(screen.getByLabelText(/^Amount/)).toHaveValue("115,500.00");
    expect(screen.getByLabelText(/^Due date/)).toHaveValue("2026-10-10");
    expect(container.querySelector('input[name="version"]')).toHaveValue(
      "2026-10-14T04:00:00.000Z",
    );
  });

  it("refuse a Viewer, loading nothing", async () => {
    access("VIEWER");
    render(await AddPaymentPage({ params: Promise.resolve({ eventId: ID, supplierId: "s1" }) }));
    expect(screen.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    document.body.innerHTML = "";
    render(
      await EditPaymentPage({
        params: Promise.resolve({ eventId: ID, supplierId: "s1", paymentId: "p2" }),
      }),
    );
    expect(screen.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();
    expect(getPaymentFormContext).not.toHaveBeenCalled();
  });

  it("are not found for another event's or supplier's payment", async () => {
    access("OWNER");
    getPaymentFormContext.mockResolvedValue({ ok: false, reason: "not-found" });
    await expect(
      EditPaymentPage({
        params: Promise.resolve({ eventId: ID, supplierId: "s1", paymentId: "other" }),
      }),
    ).rejects.toMatchObject({ digest: expect.stringMatching(/404|NOT_FOUND/) });
    await expect(
      AddPaymentPage({ params: Promise.resolve({ eventId: ID, supplierId: "other" }) }),
    ).rejects.toMatchObject({ digest: expect.stringMatching(/404|NOT_FOUND/) });
  });
});