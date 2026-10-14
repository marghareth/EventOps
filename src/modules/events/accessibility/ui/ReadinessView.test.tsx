// src/modules/events/accessibility/ui/ReadinessView.test.tsx
// The readiness view's parts (B3-10): status in words with the counts behind it, gaps as readable
// actions (guests, consequence, fix link for managers), needs grouped by type, and empty states.
// Data comes from the real domain rules.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { detectGaps } from "../domain/gaps";
import {
  assessCoverage,
  type ReadinessRequirement,
  type ReadinessResource,
} from "../domain/readiness";
import { decidingCounts, readinessStatus } from "../domain/readiness-status";
import type { RequirementPriority, RequirementType } from "../domain/requirement-type";
import { GapList } from "./GapList";
import { NeedsOverview } from "./NeedsOverview";
import { ReadinessSummary } from "./ReadinessSummary";

let n = 0;
const need = (
  type: RequirementType,
  guest: number,
  priority: RequirementPriority = "REQUIRED",
  rsvp: ReadinessRequirement["attendee"]["rsvpStatus"] = "CONFIRMED",
): ReadinessRequirement => {
  n += 1;
  return {
    id: `q${n}`,
    type,
    priority,
    attendee: { id: `a${guest}`, number: guest, name: `Guest ${guest}`, rsvpStatus: rsvp },
  };
};
const view = (requirements: ReadinessRequirement[], resources: ReadinessResource[]) => {
  const coverage = assessCoverage({ requirements, resources });
  return {
    coverage,
    status: readinessStatus(coverage),
    counts: decidingCounts(coverage),
    gaps: detectGaps(coverage),
  };
};
const PATHS = { basePath: "/events/e1/accessibility", attendeesPath: "/events/e1/attendees" };

describe("ReadinessSummary", () => {
  it.each([
    ["READY", "Ready", "Every Required need of guests who are coming is covered."],
    ["NOT_READY", "Not ready", "At least one Required need has no resource in place"],
    ["ALMOST_READY", "Almost ready", "Nothing is missing, but"],
    ["NO_REQUIRED_NEEDS", "No required needs", "nothing decides readiness yet"],
  ] as const)("states %s in words with its meaning", (status, label, text) => {
    render(
      <ReadinessSummary
        status={status}
        counts={{ total: 0, covered: 0, arranging: 0, "check-by-hand": 0, missing: 0, short: 0 }}
      />,
    );
    const region = screen.getByRole("region", { name: "Accessibility readiness" });
    expect(region).toHaveTextContent(`Status: ${label}`);
    expect(region).toHaveTextContent(text);
  });

  it("gives the counts behind the status", () => {
    const v = view(
      [
        need("CAPTIONING", 1),
        need("SIGN_LANGUAGE", 2),
        need("OTHER", 3),
        need("ACCESSIBLE_RESTROOM", 4),
      ],
      [
        { type: "CAPTIONING", status: "AVAILABLE", quantity: null },
        { type: "SIGN_LANGUAGE", status: "ARRANGING", quantity: null },
      ],
    );
    render(<ReadinessSummary status={v.status} counts={v.counts} />);
    expect(screen.getByRole("region")).toHaveTextContent(
      "1 of 4 Required needs covered: 1 missing or short, 1 being arranged, 1 to check by hand.",
    );
  });
});

describe("GapList", () => {
  const v = view(
    [need("ACCESSIBLE_SEATING", 1), need("ACCESSIBLE_SEATING", 2), need("OTHER", 3)],
    [{ type: "ACCESSIBLE_SEATS", status: "AVAILABLE", quantity: 1 }],
  );

  it("shows each gap as a sentence, its consequence, the guests and the numbers", () => {
    render(<GapList gaps={v.gaps} status={v.status} {...PATHS} canManage />);
    const items = within(screen.getByRole("region", { name: "What's missing" }))
      .getAllByRole("listitem")
      .filter((li) => li.querySelector("h3"));
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByRole("heading", { level: 3 })).toHaveTextContent(
      "Not enough accessible seats: 2 guests with a Required need, 1 seat available.",
    );
    expect(items[0]).toHaveTextContent("Makes the event Not ready.");
    expect(items[0]).toHaveTextContent("Seats available: 1 · Required seating needs: 2");
    expect(within(items[0]).getByRole("link", { name: "Guest 2 (ATT-0002)" })).toHaveAttribute(
      "href",
      "/events/e1/attendees/a2",
    );
    expect(within(items[0]).getByRole("link", { name: "Edit Accessible seats" })).toHaveAttribute(
      "href",
      "/events/e1/accessibility/accessible-seats/edit",
    );
    expect(items[1]).toHaveTextContent("Keeps the event at Almost ready.");
  });

  it("offers no fix links to a Viewer, but still names the guests", () => {
    render(<GapList gaps={v.gaps} status={v.status} {...PATHS} canManage={false} />);
    const region = screen.getByRole("region", { name: "What's missing" });
    expect(within(region).queryByRole("link", { name: /^(Edit|Set up) / })).toBeNull();
    expect(within(region).getAllByRole("link", { name: /ATT-000/ })).toHaveLength(3);
  });

  it.each([
    ["READY", "Nothing is missing. Every need is covered."],
    ["NO_REQUIRED_NEEDS", "Nothing to check yet: no guest who is coming has a Required need."],
  ] as const)("says why there are no gaps (%s)", (status, text) => {
    render(<GapList gaps={[]} status={status} {...PATHS} canManage />);
    expect(screen.getByRole("region", { name: "What's missing" })).toHaveTextContent(text);
  });
});

describe("NeedsOverview", () => {
  it("groups needs by type with Required and Preferred counts, and names what isn't counted", () => {
    const v = view(
      [
        need("CAPTIONING", 2),
        need("CAPTIONING", 1, "PREFERRED"),
        need("ACCESSIBLE_SEATING", 3),
        need("SIGN_LANGUAGE", 4, "REQUIRED", "DECLINED"),
        need("OTHER", 5, "INFORMATIONAL"),
      ],
      [],
    );
    render(<NeedsOverview coverage={v.coverage} attendeesPath={PATHS.attendeesPath} />);
    const region = screen.getByRole("region", { name: "What guests need" });
    expect(
      within(region)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["Accessible seating", "Captioning"]);
    expect(region).toHaveTextContent("Captioning1 Required, 1 Preferred");
    expect(within(region).getByRole("link", { name: "Guest 1 (ATT-0001)" })).toBeVisible();
    expect(region).toHaveTextContent(
      "Not counted: 1 for guests who declined, 1 marked For information.",
    );
  });

  it("points to the guest list when nothing is recorded", () => {
    render(<NeedsOverview coverage={view([], []).coverage} attendeesPath={PATHS.attendeesPath} />);
    expect(screen.getByRole("link", { name: "guest list" })).toHaveAttribute(
      "href",
      "/events/e1/attendees",
    );
  });
});