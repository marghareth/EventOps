// src/modules/events/import/ui/ImportWizard.test.tsx
// Import steps (B2-14 to B2-18, D-052; B9, D-109 to D-112): what each step shows, which fields it
// carries to the next step, how the suggestion is labelled, and that the confirm button names
// exactly what will be imported.
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FieldOption, ImportState } from "../import-state";
import { ImportWizard } from "./ImportWizard";

const LIST = "/events/e1/attendees";
const SUPPLIERS = "/events/e1/suppliers";
const HREFS = { attendees: LIST, suppliers: SUPPLIERS };

const ATTENDEE_FIELDS: FieldOption[] = [
  { id: "name", label: "Name", required: true },
  { id: "email", label: "Email", required: false },
  { id: "phone", label: "Phone", required: false },
  { id: "rsvpStatus", label: "RSVP", required: false },
  { id: "plusOnes", label: "Plus-ones", required: false },
  { id: "category", label: "Category", required: false },
  { id: "dietaryNeeds", label: "Dietary needs", required: false },
  { id: "notes", label: "Notes", required: false },
];

/** Renders the wizard, then has the action answer with `next` for the first submit. */
async function at(next: ImportState) {
  const action = vi.fn(async () => next);
  render(<ImportWizard action={action} listHrefs={HREFS} maxRows={2000} />);
  if (next.step !== "upload") {
    const file = new File(["Name\nAna"], "guests.csv", { type: "text/csv" });
    await userEvent.upload(screen.getByLabelText("CSV or Excel file"), file);
    await userEvent.click(screen.getByRole("button", { name: "Upload and continue" }));
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await act(async () => {});
  }
  return action;
}

const context = {
  importType: "attendees" as const,
  csv: "Guest Name,Email,Table\nAna,ana@x.co,T1",
  fileName: "guests.csv",
  fileType: "csv" as const,
  headers: ["Guest Name", "Email", "Table"],
  fields: ATTENDEE_FIELDS,
  aiSuggested: false,
};
const mapExtras = { columnTypes: ["text", "email", "text"] as ("text" | "email")[] };

describe("ImportWizard", () => {
  it("starts with the import type, a labelled CSV or Excel picker, and says nothing is saved yet", () => {
    render(<ImportWizard action={vi.fn()} listHrefs={HREFS} maxRows={2000} />);
    expect(screen.getByRole("heading", { name: "1. Choose a file" })).toBeVisible();
    const group = screen.getByRole("group", { name: "What are you importing?" });
    expect(within(group).getByRole("radio", { name: /Attendees/ })).toBeChecked();
    expect(within(group).getByRole("radio", { name: /Suppliers/ })).not.toBeChecked();
    expect(screen.getByLabelText("CSV or Excel file")).toHaveAttribute(
      "accept",
      ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(screen.getByText(/Nothing is saved until you confirm/)).toBeVisible();
    expect(screen.getByText(/Up to 2,000 rows/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to the guest list" })).toHaveAttribute(
      "href",
      LIST,
    );
  });

  it("can start with suppliers chosen (from the Suppliers page)", () => {
    render(
      <ImportWizard action={vi.fn()} listHrefs={HREFS} initialType="suppliers" maxRows={2000} />,
    );
    expect(screen.getByRole("radio", { name: /Suppliers/ })).toBeChecked();
    expect(screen.getByRole("link", { name: "Back to the supplier list" })).toHaveAttribute(
      "href",
      SUPPLIERS,
    );
  });

  it("shows each column with examples and a field choice, keeping the suggestion", async () => {
    await at({
      ...context,
      ...mapExtras,
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
    expect(document.querySelector("input[name=importType]")).toHaveValue("attendees");
    expect(document.querySelector("input[name=fileType]")).toHaveValue("csv");
    // The detected type of each column is shown in words.
    expect(screen.getByRole("row", { name: /Email/ })).toHaveTextContent("Email addresses");
  });

  it("labels an AI suggestion, per column, and says the user checks it (D-111)", async () => {
    await at({
      ...context,
      ...mapExtras,
      aiSuggested: true,
      step: "map",
      mapping: ["name", "email", null],
      suggested: ["name", "email", null],
      notice: { source: "ai", model: "Qwen2.5 7B Instruct (Apache-2.0)" },
      rowCount: 1,
      examples: [["Ana"], ["ana@x.co"], ["T1"]],
    });
    // The banner title, and a note under each of the two columns the AI matched.
    expect(screen.getAllByText("Suggested by AI")).toHaveLength(3);
    expect(
      screen.getByText(/model, Qwen2.5 7B Instruct \(Apache-2.0\), suggested the matching/),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Guest Name" })).toHaveAccessibleDescription(
      "Suggested by AI",
    );
    expect(screen.getByRole("combobox", { name: "Table" })).not.toHaveAccessibleDescription();
    expect(document.querySelector("input[name=aiSuggested]")).toHaveValue("true");
  });

  it("says when the rules matched because AI wasn't available (D-112)", async () => {
    await at({
      ...context,
      ...mapExtras,
      step: "map",
      mapping: ["name", "email", null],
      notice: { source: "rules", fallback: "unavailable" },
      rowCount: 1,
      examples: [[], [], []],
    });
    expect(screen.getByText("Matched by rules: AI wasn't available")).toBeVisible();
    expect(screen.queryByText("Suggested by AI")).not.toBeInTheDocument();
  });

  it("offers to switch when the columns look like the other list", async () => {
    await at({
      ...context,
      ...mapExtras,
      step: "map",
      mapping: ["name", "email", null],
      looksLike: "suppliers",
      rowCount: 1,
      examples: [[], [], []],
    });
    expect(screen.getByText("These columns look like a supplier list")).toBeVisible();
    const button = screen.getByRole("button", { name: "Import as suppliers instead" });
    expect(button).toHaveAttribute("value", "switch-type");
    expect(document.querySelector("input[name=switchTo]")).toHaveValue("suppliers");
  });

  it("shows a new suggestion's fields after switching type, not the old selections", async () => {
    const first: ImportState = {
      ...context,
      ...mapExtras,
      step: "map",
      mapping: [null, "email", null],
      looksLike: "suppliers",
      rowCount: 1,
      examples: [[], [], []],
    };
    const switched: ImportState = {
      ...first,
      importType: "suppliers",
      mapping: ["name", "email", null],
      looksLike: undefined,
    };
    const action = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(switched);
    render(<ImportWizard action={action} listHrefs={HREFS} maxRows={2000} />);
    await userEvent.upload(
      screen.getByLabelText("CSV or Excel file"),
      new File(["x"], "g.csv", { type: "text/csv" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Upload and continue" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Import as suppliers instead" }),
    );
    await vi.waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Guest Name" })).toHaveValue("name"),
    );
  });

  it("names the sheet of an Excel file and offers another sheet", async () => {
    await at({
      ...context,
      ...mapExtras,
      fileName: "guests.xlsx",
      fileType: "xlsx",
      sheet: "Guests",
      sheets: ["Guests", "Suppliers"],
      step: "map",
      mapping: ["name", "email", null],
      rowCount: 1,
      examples: [[], [], []],
    });
    expect(screen.getByText(/from guests\.xlsx \(sheet “Guests”\)/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose another sheet" })).toBeVisible();
  });

  it("lists mapping problems", async () => {
    await at({
      ...context,
      ...mapExtras,
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

  const preview: ImportState & { step: "preview" } = {
    ...context,
    step: "preview",
    mapping: ["name", "email", null],
    includeDuplicates: false,
    correctionCsv: "Guest Name,Email,Table\r\n,x,T2\r\n",
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
    const withRsvp: ImportState & { step: "preview" } = {
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
    await at({
      step: "done",
      importType: "attendees",
      count: 184,
      first: "ATT-0009",
      last: "ATT-0192",
      skipped: 6,
    });
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

  it("words a supplier import for suppliers, start to finish", async () => {
    await at({
      ...preview,
      importType: "suppliers",
      fields: [
        { id: "name", label: "Name", required: true },
        { id: "email", label: "Email", required: false },
      ],
    });
    expect(screen.getByText(/Same name as a supplier already added/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Import 1 supplier" })).toBeEnabled();
  });

  it("reports a supplier import with a way to the supplier list", async () => {
    await at({
      step: "done",
      importType: "suppliers",
      count: 2,
      first: "SUP-0005",
      last: "SUP-0006",
      skipped: 0,
    });
    expect(screen.getByRole("status")).toHaveTextContent("2 suppliers were added");
    expect(screen.getByRole("link", { name: "Go to the supplier list" })).toHaveAttribute(
      "href",
      SUPPLIERS,
    );
  });

  it("asks for the sheet when the server lists a workbook's sheets", async () => {
    const action = vi.fn(async (): Promise<ImportState> => ({
      step: "upload",
      sheets: ["Guests", "Vendors"],
      sheet: "Vendors",
    }));
    render(<ImportWizard action={action} listHrefs={HREFS} maxRows={2000} />);
    await userEvent.click(screen.getByRole("button", { name: "Upload and continue" }));
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("combobox", { name: "Sheet to read" })).toHaveValue("Vendors");
  });

  it("shows an upload error from the server", async () => {
    const action = vi.fn(async (): Promise<ImportState> => ({
      step: "upload",
      error: "Choose a .csv or .xlsx file.",
    }));
    render(<ImportWizard action={action} listHrefs={HREFS} maxRows={2000} />);
    await userEvent.upload(
      screen.getByLabelText("CSV or Excel file"),
      new File(["x"], "g.csv", { type: "text/csv" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Upload and continue" }));
    await vi.waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a .csv or .xlsx file.");
  });
});