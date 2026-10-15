// src/modules/events/suppliers/ui/PaymentStatusBadge.test.tsx
// The supplier payment status badge (B4-13): the canonical label as text with an icon for every
// status, so meaning never depends on color alone.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SUPPLIER_PAYMENT_STATUSES, SUPPLIER_PAYMENT_STATUS_DEFINITIONS } from "../payment-status";
import { PaymentStatusBadge } from "./PaymentStatusBadge";

describe("PaymentStatusBadge", () => {
  it.each(SUPPLIER_PAYMENT_STATUSES)("writes %s as its canonical label with an icon", (status) => {
    const { container } = render(<PaymentStatusBadge status={status} />);
    expect(screen.getByText(SUPPLIER_PAYMENT_STATUS_DEFINITIONS[status].label)).toBeVisible();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});