// src/modules/events/attendees/ui/ExportButton.test.tsx
// Export with feedback (B2-22, D-053): a real link without JavaScript; with it, a background
// download that says what was downloaded, or the server's safe error in a banner.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportButton } from "./ExportButton";

const HREF = "/api/events/e1/attendees/export";
const CSV = '﻿ID,Name,Notes\r\nATT-0001,Ana,"Line one\r\nLine two"\r\nATT-0002,Ben,\r\n';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("ExportButton", () => {
  it("is a real download link, so it works without JavaScript", () => {
    render(<ExportButton href={HREF} />);
    const link = screen.getByRole("link", { name: "Export CSV" });
    expect(link).toHaveAttribute("href", HREF);
    expect(link).toHaveAttribute("download");
  });

  it("downloads in the background and says what was downloaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(CSV, {
            status: 200,
            headers: {
              "content-disposition":
                'attachment; filename="EVT-2026-0001-attendees-2026-10-13.csv"',
            },
          }),
      ),
    );
    render(<ExportButton href={HREF} />);
    await userEvent.click(screen.getByRole("link", { name: "Export CSV" }));
    expect(
      await screen.findByText("Downloaded EVT-2026-0001-attendees-2026-10-13.csv (2 attendees)."),
    ).toHaveAttribute("role", "status");
    expect(fetch).toHaveBeenCalledWith(HREF, { credentials: "same-origin" });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("shows the server's safe message when the export is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Your role doesn't allow this." }, { status: 403 })),
    );
    render(<ExportButton href={HREF} />);
    await userEvent.click(screen.getByRole("link", { name: "Export CSV" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Export didn't work");
    expect(alert).toHaveTextContent("Your role doesn't allow this.");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("shows a general message when the network fails, and can be dismissed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    render(<ExportButton href={HREF} />);
    await userEvent.click(screen.getByRole("link", { name: "Export CSV" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't export the guest list. Try again in a moment.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});