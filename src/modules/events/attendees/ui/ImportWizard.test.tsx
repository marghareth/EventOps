// src/modules/events/attendees/ui/ImportWizard.test.tsx
// CSV import steps (B2-14 to B2-18, D-052): what each step shows, which fields it carries to the
// next step, and that the confirm button names exactly what will be imported.
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ImportState } from "../import-state";
import { ImportWizard } from "./ImportWizard";

const LIST = "/events/e1/attendees";

/** Renders the wizard, then has the action answer with `next` for the first submit. */
async function at(next: ImportState) {
  const action = vi.fn(async () => next);
  render(<ImportWizard action={action} listHref={LIST} />);
  if (next.step !== "upload") {
    const file = new File(["Name\nAna"], "guests.csv", { type: "text/csv" });
    await userEvent.upload(screen.getByLabelText("CSV file"), file);
    await userEvent.click(screen.getByRole("button", { name: "Upload and continue" }));
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await act(async () => {});
  }
  return action;
}

const context = {
  csv: "Guest Name,Email,Table\nAna,ana@x.co,T1",
  fileName: "guests.csv",
  headers: ["Guest Name", "Email", "Table"],
};

describe("ImportWizard", () => {
  it("starts with a labelled .csv file picker and says nothing is saved yet", () => {
    render(<ImportWizard action={vi.fn()} listHref={LIST} />);
    expect(screen.getByRole("heading", { name: "1. Choose a CSV file" })).toBeVisible();
    expect(screen.getByLabelText("CSV file")).toHaveAttribute("accept", ".csv,text/csv");
    expect(screen.getByText(/Nothing is saved until you confirm/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to the guest list" })).toHaveAttribute(
      "href",
      LIST,
    );
  });

  it("shows each column with examples and a field choice, keeping the suggestion", async () => {
    await at({
      ...context,
      step: "map",
      mapping: ["name", "email", null],
      rowCount: 1,
      examples: [["Ana"], ["ana@x.co"], ["T1"]],
    });
    expect(screen.getByRole("heading", { name: "2. Match your columns" })).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Guest Name" })).toHaveValue("name");
    expect(screen.getByRole("combobox", { name: "Table" })).toHaveValue("");
    const options = within(screen.getByRole("combobox", { name: "Table" }))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual([
      "Don't import",
      "Name (required)",
      "Email",
      "Phone",
      "RSVP",
      "Plus-ones",
      "Category",
      "Dietary needs",
      "Notes",
    ]);
    expect(document.querySelector("input[name=csv]")).toHaveValue(context.csv);
  });

  it("lists mapping problems", async () => {
    await at({
      ...context,
      step: "map",
      mapping: [null, "email", null],
      rowCount: 1,
      examples: [[], [], []],
      errors: ["Choose the column that holds each guest's name."],
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose the column that holds each guest's name.",
    );
  });

  const preview: ImportState = {
    ...context,
    step: "preview",
    mapping: ["name", "email", null],
    includeDuplicates: false,
    preview: {
      totals: { rows: 3, valid: 1, invalid: 1, duplicates: 1, toImport: 1 },
      ignoredColumns: ["Table"],
      rows: [
        {
          line: 2,
          status: "valid",
          values: { name: "Ana", email: "ana@x.co" },
          saved: { name: "Ana", email: "ana@x.co" },
          errors: [],
          cells: ["Ana", "ana@x.co", "T1"],
        },
        {
          line: 3,
          status: "invalid",
          values: { name: "", email: "x" },
          errors: ["Name: Enter the attendee's name."],
          cells: ["", "x", "T2"],
        },
        {
          line: 4,
          status: "duplicate",
          values: { name: "Ana", email: "" },
          errors: [],
          duplicateOf: "Repeats line 2 of the file",
          cells: ["Ana", "", "T3"],
        },
      ],
    },
  };

  it("previews the totals, the matching, and each group of rows with its reasons", async () => {
    await at(preview);
    expect(screen.getByRole("heading", { name: "3. Check before importing" })).toHaveFocus();
    expect(screen.getByText("Rows in the file").nextElementSibling).toHaveTextContent("3");
    expect(screen.getByText("Will be imported").nextElementSibling).toHaveTextContent("1");
    expect(
      screen.getByText(/Name ← Guest Name · Email ← Email\. Not imported: Table\./),
    ).toBeVisible();
    expect(screen.getByRole("region", { name: "Rows that need correction" })).toHaveTextContent(
      "Name: Enter the attendee's name.",
    );
    expect(screen.getByRole("region", { name: "Possible duplicates" })).toHaveTextContent(
      "Repeats line 2 of the file",
    );
    expect(screen.getByRole("region", { name: "Rows that will be imported" })).toHaveTextContent(
      "ana@x.co",
    );
    expect(screen.getByRole("button", { name: "Download these rows" })).toBeVisible();
    // The mapping travels with the confirm, and the number shown is the number expected.
    expect(document.querySelector("input[name='map-1']")).toHaveValue("email");
    expect(document.querySelector("input[name=expected]")).toHaveValue("1");
    expect(screen.getByRole("button", { name: "Import 1 attendee" })).toBeEnabled();
  });

  it("shows what will be saved for rows to import, and the file's values for rows needing correction", async () => {
    const withRsvp: ImportState = {
      ...preview,
      mapping: ["name", "rsvpStatus", null],
      preview: {
        ...preview.preview,
        rows: [
          {
            line: 2,
            status: "valid",
            values: { name: "Ana", rsvpStatus: "yes" },
            saved: { name: "Ana", rsvpStatus: "Confirmed" },
            errors: [],
            cells: [],
          },
          {
            line: 3,
            status: "invalid",
            values: { name: "Ben", rsvpStatus: "perhaps" },
            errors: ["RSVP: no"],
            cells: [],
          },
        ],
      },
    };
    await at(withRsvp);
    expect(screen.getByRole("region", { name: "Rows that will be imported" })).toHaveTextContent(
      "Confirmed",
    );
    expect(
      screen.getByRole("region", { name: "Rows that will be imported" }),
    ).not.toHaveTextContent("yes");
    expect(screen.getByRole("region", { name: "Rows that need correction" })).toHaveTextContent(
      "perhaps",
    );
  });

  it("counts duplicates in when the user chooses to import them", async () => {
    await at(preview);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Import possible duplicates anyway" }),
    );
    expect(screen.getByRole("button", { name: "Import 2 attendees" })).toBeVisible();
    expect(document.querySelector("input[name=expected]")).toHaveValue("2");
  });

  it("can't confirm when nothing would be imported", async () => {
    await at({
      ...preview,
      preview: {
        ...preview.preview,
        totals: { rows: 1, valid: 0, invalid: 1, duplicates: 0, toImport: 0 },
        rows: [preview.preview.rows[1]],
      },
    });
    expect(screen.getByRole("button", { name: "Import 0 attendees" })).toBeDisabled();
  });

  it("shows why a confirm didn't import", async () => {
    await at({
      ...preview,
      message:
        "The guest list changed since this preview. Check the new numbers, then confirm again.",
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "The guest list changed since this preview.",
    );
  });

  it("reports the result with the new IDs and a way back to the guest list", async () => {
    await at({ step: "done", count: 184, first: "ATT-0009", last: "ATT-0192", skipped: 6 });
    expect(screen.getByRole("heading", { name: "Import complete" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("184 attendees were added");
    expect(screen.getByRole("status")).toHaveTextContent(
      "As ATT-0009 to ATT-0192. 6 rows weren't imported.",
    );
    expect(screen.getByRole("link", { name: "Go to the guest list" })).toHaveAttribute(
      "href",
      LIST,
    );
  });

  it("shows an upload error from the server", async () => {
    const action = vi.fn(async (): Promise<ImportState> => ({
      step: "upload",
      error: "Choose a .csv file.",
    }));
    render(<ImportWizard action={action} listHref={LIST} />);
    await userEvent.upload(
      screen.getByLabelText("CSV file"),
      new File(["x"], "g.csv", { type: "text/csv" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Upload and continue" }));
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a .csv file.");
  });
});