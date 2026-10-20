// src/modules/events/suppliers/ui/QuoteStatusBadge.test.tsx
// A quote's status (B4-11, D-076; B10-F14): always a word from the canonical list with an icon,
// never colour alone. This file held a copy of the component instead of tests; replaced in B10.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QUOTE_STATUSES } from "../quote-statuses";
import { QuoteStatusBadge } from "./QuoteStatusBadge";

describe("QuoteStatusBadge", () => {
  it.each([
    ["PENDING", "Pending"],
    ["ACCEPTED", "Accepted"],
    ["DECLINED", "Declined"],
  ] as const)("shows %s as the word %j with an icon", (status, label) => {
    const { container } = render(<QuoteStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeVisible();
    expect(container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
  });

  it("has a badge for every status", () => {
    for (const status of QUOTE_STATUSES) {
      const { unmount } = render(<QuoteStatusBadge status={status} />);
      unmount();
    }
  });
});