// src/modules/events/suppliers/read.ts
// Supplier reads for pages (B4-03, D-068; the detail read B4-07, D-074; quotes B4-09, D-075;
// payments B4-14, D-077 to D-079). Payment and due statuses are calculated here, on the server,
// from stored records and today's date in Manila; the browser only shows them. Each read
// authorizes itself (D-036): every member may read the supplier list (event.view), including
// contact details, which are business contacts (D-068, option 3a); only roles with
// suppliers.manage are told they may change it.
import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { isSampleDataMode } from "@/lib/demo-auth";
import { listAuditEntries, type AuditEntryView } from "@/modules/events/audit/public";
import {
  authorizeEvent,
  can,
  sampleGetPayment,
  sampleGetQuote,
  sampleGetSupplier,
  sampleListAuditEntries,
  sampleListEventPayments,
  sampleListPayments,
  sampleListQuotes,
  sampleListSuppliers,
  type EventAuthorization,
} from "@/modules/events/public";
import { getSupplier, listSuppliersWithMoney, type SupplierRecord } from "./queries";
import {
  manilaToday,
  paymentDueStatus,
  supplierDueSummary,
  type PaymentDueStatus,
  type SupplierDueSummary,
} from "./payment-due";
import { getPayment, listSupplierPayments, type PaymentRecord } from "./payment-queries";
import { supplierPaymentSummary, type SupplierPaymentSummary } from "./payment-status";
import { getQuote, listSupplierQuotes, type QuoteRecord } from "./quote-queries";
import { supplierOverview, type SupplierOverview } from "./supplier-overview";
import {
  DEFAULT_SUPPLIER_QUERY,
  filterSuppliers,
  type SupplierListQuery,
} from "./supplier-list-query";

type Refused = { ok: false; reason: Extract<EventAuthorization, { ok: false }>["reason"] };

const suppliersPath = (eventId: string) => `/events/${encodeURIComponent(eventId)}/suppliers`;

/** A supplier on the list, with its money overview (B4-16, D-081). */
export type SupplierListItem = SupplierRecord & { overview: SupplierOverview };

export type EventSuppliers =
  | {
      ok: true;
      /** The suppliers matching the query (all of them when it doesn't narrow), by name. */
      suppliers: SupplierListItem[];
      /** How many suppliers the event has before search (B4-17). */
      total: number;
      /** Whether the reader may add, edit and remove suppliers (suppliers.manage). */
      canManage: boolean;
    }
  | Refused;

/**
 * The event's suppliers, by name, each with its Accepted quote, pending quotes, payment status and
 * next due date (B4-03, B4-16), narrowed by the search (B4-17). Every member. Statuses are calculated here from stored records and
 * today's date in Manila, with the same rules as the supplier's page.
 */
export async function getEventSuppliers(
  eventId: string,
  query: SupplierListQuery = DEFAULT_SUPPLIER_QUERY,
): Promise<EventSuppliers> {
  const auth = await authorizeEvent(eventId, "event.view", suppliersPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const rows = isSampleDataMode()
    ? sampleSuppliersWithMoney(auth.event.id) // Dev-only sample data (D-041).
    : await listSuppliersWithMoney(getDb(), auth.event.id);
  const today = manilaToday(new Date());
  const suppliers = rows.map(({ quotes, payments, ...supplier }) => ({
    ...supplier,
    overview: supplierOverview({ quotes, payments }, today),
  }));
  // Search (B4-17, D-082) runs here, on the server, only over this event's authorized suppliers.
  return {
    ok: true,
    suppliers: filterSuppliers(suppliers, query),
    total: suppliers.length,
    canManage: can(auth.event.role, "suppliers.manage"),
  };
}

/** The sample store's suppliers with their quotes and payments, like listSuppliersWithMoney. */
function sampleSuppliersWithMoney(eventId: string) {
  const payments = sampleListEventPayments(eventId);
  return sampleListSuppliers(eventId).map((supplier) => ({
    ...supplier,
    quotes: sampleListQuotes(eventId, supplier.id),
    payments: payments.filter((payment) => payment.supplierId === supplier.id),
  }));
}

export type SupplierForEditing =
  | { ok: true; supplier: SupplierRecord }
  /** not-found: unknown supplier, another event's supplier or a malformed ID (indistinguishable). */
  | Refused;

/**
 * One supplier for the edit form (B4-04). Authorizes itself with suppliers.manage, and finds the
 * supplier only inside the authorized event.
 */
export async function getSupplierForEditing(
  eventId: string,
  supplierId: string,
): Promise<SupplierForEditing> {
  const auth = await authorizeEvent(eventId, "suppliers.manage", suppliersPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  if (!z.uuid().safeParse(supplierId).success) return { ok: false, reason: "not-found" };
  const supplier = isSampleDataMode()
    ? sampleGetSupplier(auth.event.id, supplierId) // Dev-only sample data (D-041).
    : await getSupplier(getDb(), auth.event.id, supplierId);
  return supplier ? { ok: true, supplier } : { ok: false, reason: "not-found" };
}

/** How many Activity entries the detail page shows (newest first). */
export const SUPPLIER_ACTIVITY_LIMIT = 10;

export type SupplierDetail =
  | {
      ok: true;
      supplier: SupplierRecord;
      /** The supplier's quotes, by number (B4-09). Every member may see them (D-075). */
      quotes: QuoteRecord[];
      /** The supplier's payments, by due date, each with its due status (B4-14, D-079). */
      payments: (PaymentRecord & { dueStatus: PaymentDueStatus })[];
      /** Paid against the Accepted quote (D-078). */
      paymentSummary: SupplierPaymentSummary;
      /** Overdue count and next unpaid payment (D-079). */
      dueSummary: SupplierDueSummary;
      /** Whether the reader may edit and remove the supplier and its quotes (suppliers.manage). */
      canManage: boolean;
      /** The supplier's latest Activity entries, or null when the role may not see Activity. */
      activity: AuditEntryView[] | null;
    }
  /** not-found: unknown supplier, another event's supplier or a malformed ID (indistinguishable). */
  | Refused;

/**
 * One supplier's detail page (B4-07, D-074). Every member may read it (event.view), including
 * contacts (D-068) and quotes (D-075). The supplier is found only inside the authorized event. Its Activity entries are
 * loaded only for roles with audit.view (Viewers never get them, D-035).
 */
export async function getSupplierDetail(
  eventId: string,
  supplierId: string,
): Promise<SupplierDetail> {
  const auth = await authorizeEvent(eventId, "event.view", suppliersPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  if (!z.uuid().safeParse(supplierId).success) return { ok: false, reason: "not-found" };
  const sample = isSampleDataMode(); // Dev-only sample data (D-041).
  const supplier = sample
    ? sampleGetSupplier(auth.event.id, supplierId)
    : await getSupplier(getDb(), auth.event.id, supplierId);
  if (!supplier) return { ok: false, reason: "not-found" };
  const quotes = sample
    ? sampleListQuotes(auth.event.id, supplier.id)
    : await listSupplierQuotes(getDb(), auth.event.id, supplier.id);
  const storedPayments = sample
    ? sampleListPayments(auth.event.id, supplier.id)
    : await listSupplierPayments(getDb(), auth.event.id, supplier.id);
  const today = manilaToday(new Date());
  const payments = storedPayments.map((payment) => ({
    ...payment,
    dueStatus: paymentDueStatus(payment, today),
  }));
  const accepted = quotes.find((quote) => quote.status === "ACCEPTED");
  const paymentSummary = supplierPaymentSummary({
    acceptedAmount: accepted?.amount ?? null,
    payments,
  });
  const dueSummary = supplierDueSummary(payments, today);
  let activity: AuditEntryView[] | null = null;
  if (can(auth.event.role, "audit.view")) {
    // Entries about the supplier, its quotes (B4-09) and its payments (B4-14).
    const about = [supplier.id, ...quotes.map((q) => q.id), ...payments.map((p) => p.id)];
    activity = sample
      ? sampleListAuditEntries(auth.event.id, SUPPLIER_ACTIVITY_LIMIT, about)
      : await listAuditEntries(getDb(), auth.event.id, SUPPLIER_ACTIVITY_LIMIT, about);
  }
  return {
    ok: true,
    supplier,
    quotes,
    payments,
    paymentSummary,
    dueSummary,
    canManage: can(auth.event.role, "suppliers.manage"),
    activity,
  };
}

export type QuoteForEditing =
  | { ok: true; supplier: SupplierRecord; quote: QuoteRecord }
  /** not-found: unknown supplier or quote, or another event's or supplier's (indistinguishable). */
  | Refused;

/**
 * One quote for the edit form (B4-10). Authorizes itself with suppliers.manage, finds the supplier
 * only inside the authorized event and the quote only for that supplier.
 */
export async function getQuoteForEditing(
  eventId: string,
  supplierId: string,
  quoteId: string,
): Promise<QuoteForEditing> {
  const auth = await authorizeEvent(eventId, "suppliers.manage", suppliersPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const ids = z.object({ supplierId: z.uuid(), quoteId: z.uuid() });
  if (!ids.safeParse({ supplierId, quoteId }).success) return { ok: false, reason: "not-found" };
  const sample = isSampleDataMode(); // Dev-only sample data (D-041).
  const supplier = sample
    ? sampleGetSupplier(auth.event.id, supplierId)
    : await getSupplier(getDb(), auth.event.id, supplierId);
  if (!supplier) return { ok: false, reason: "not-found" };
  const quote = sample
    ? sampleGetQuote(auth.event.id, supplier.id, quoteId)
    : await getQuote(getDb(), auth.event.id, supplier.id, quoteId);
  return quote ? { ok: true, supplier, quote } : { ok: false, reason: "not-found" };
}

export type PaymentFormContext =
  | {
      ok: true;
      supplier: SupplierRecord;
      /** The payment to edit, or null when adding. */
      payment: PaymentRecord | null;
      /** Today in Manila ("YYYY-MM-DD"), for the paid date's upper limit (D-079). */
      today: string;
    }
  /** not-found: unknown supplier or payment, or another event's or supplier's (indistinguishable). */
  | Refused;

/**
 * The supplier (and, when editing, the payment) for the payment forms (B4-14). Authorizes itself
 * with suppliers.manage, finds the supplier only inside the authorized event and the payment only
 * for that supplier.
 */
export async function getPaymentFormContext(
  eventId: string,
  supplierId: string,
  paymentId: string | null,
): Promise<PaymentFormContext> {
  const auth = await authorizeEvent(eventId, "suppliers.manage", suppliersPath(eventId));
  if (!auth.ok) return { ok: false, reason: auth.reason };
  if (!z.uuid().safeParse(supplierId).success) return { ok: false, reason: "not-found" };
  if (paymentId !== null && !z.uuid().safeParse(paymentId).success) {
    return { ok: false, reason: "not-found" };
  }
  const sample = isSampleDataMode(); // Dev-only sample data (D-041).
  const supplier = sample
    ? sampleGetSupplier(auth.event.id, supplierId)
    : await getSupplier(getDb(), auth.event.id, supplierId);
  if (!supplier) return { ok: false, reason: "not-found" };
  let payment: PaymentRecord | null = null;
  if (paymentId !== null) {
    payment = sample
      ? sampleGetPayment(auth.event.id, supplier.id, paymentId)
      : await getPayment(getDb(), auth.event.id, supplier.id, paymentId);
    if (!payment) return { ok: false, reason: "not-found" };
  }
  return { ok: true, supplier, payment, today: manilaToday(new Date()) };
}