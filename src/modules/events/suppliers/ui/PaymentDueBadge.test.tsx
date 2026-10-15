// src/modules/events/suppliers/ui/PaymentDueBadge.test.tsx
// The payment due badge (B4-15): the canonical label as text with an icon for every due status.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PAYMENT_DUE_STATUSES, PAYMENT_DUE_STATUS_DEFINITIONS } from "../payment-due";
import { PaymentDueBadge } from "./PaymentDueBadge";

describe("PaymentDueBadge", () => {
  it.each(PAYMENT_DUE_STATUSES)("writes %s as its canonical label with an icon", (status) => {
    const { container } = render(<PaymentDueBadge status={status} />);
    expect(screen.getByText(PAYMENT_DUE_STATUS_DEFINITIONS[status].label)).toBeVisible();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});