// src/modules/events/attendees/ui/ImportWizard.tsx
// The CSV import steps (B2-14 to B2-18, D-052): upload, map columns, preview, confirm, result.
// Each step posts to one server action, which re-checks everything; this component only shows the
// state it returns. The file text travels in a hidden field between steps. Headings move focus so
// screen readers hear each new step.
"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/shared/Banner";
import { fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { CSV_LIMITS, toCsv } from "../csv";
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABEL,
  REQUIRED_IMPORT_FIELDS,
  type ImportField,
} from "../import-rules";
import { initialImportState, type ImportState, type PreviewRowView } from "../import-state";

type Action = (state: ImportState, formData: FormData) => Promise<ImportState>;

type Props = { action: Action; listHref: string };

const card = "rounded-xl bg-white p-6 shadow-xs sm:p-8";
const th =
  "bg-mist px-3 py-3 text-left font-display text-xs font-bold tracking-wider whitespace-nowrap text-ink-2 uppercase";
const td = "border-t border-line px-3 py-3 align-top break-words";
const PREVIEW_LIMIT = 100;

function StepHeading({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <h2 ref={ref} tabIndex={-1} className="text-h3 font-bold outline-none">
      {children}
    </h2>
  );
}

/** Hidden fields that carry the file and mapping to the next step. */
function Carry({ state }: { state: Extract<ImportState, { csv: string }> }) {
  return (
    <>
      <input type="hidden" name="csv" value={state.csv} />
      <input type="hidden" name="fileName" value={state.fileName} />
      {state.step === "preview"
        ? state.mapping.map((field, i) => (
            <input key={i} type="hidden" name={`map-${i}`} value={field ?? ""} />
          ))
        : null}
    </>
  );
}

function Submit({
  intent,
  children,
  pending,
  variant,
  disabled,
}: {
  intent: string;
  children: string;
  pending: boolean;
  variant?: "secondary" | "ghost";
  disabled?: boolean;
}) {
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      variant={variant}
      disabled={pending || disabled}
    >
      {children}
    </Button>
  );
}

function rowsTable(
  rows: readonly PreviewRowView[],
  fields: readonly ImportField[],
  caption: string,
  extra?: (row: PreviewRowView) => string,
) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="relative mt-3 overflow-x-auto rounded-lg border border-line"
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>
              Line
            </th>
            {extra ? (
              <th scope="col" className={th}>
                Why
              </th>
            ) : null}
            {fields.map((f) => (
              <th key={f} scope="col" className={th}>
                {IMPORT_FIELD_LABEL[f]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.line}>
              <th scope="row" className={`${td} font-mono text-[13px] text-ink-2`}>
                {row.line}
              </th>
              {extra ? <td className={`${td} min-w-56 text-ink`}>{extra(row)}</td> : null}
              {fields.map((f) => (
                <td key={f} className={`${td} max-w-64 min-w-28 text-ink-2`}>
                  {/* Rows that will be saved show what will be saved; others show the file's value. */}
                  {(row.saved ? row.saved[f] : row.values[f]) || <span aria-label="empty">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function downloadRows(headers: string[], rows: readonly PreviewRowView[], fileName: string) {
  const csv = toCsv([headers, ...rows.map((r) => r.cells)], { bom: true });
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `needs-correction-${fileName.replace(/\.csv$/i, "")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard({ action, listHref }: Props) {
  const [state, formAction, pending] = useActionState(action, initialImportState);
  // The checkbox follows the latest preview until the user changes it for that preview.
  const [choice, setChoice] = useState<{ for: ImportState; value: boolean } | null>(null);
  const includeDuplicates =
    choice?.for === state ? choice.value : state.step === "preview" && state.includeDuplicates;
  const setIncludeDuplicates = (value: boolean) => setChoice({ for: state, value });

  if (state.step === "upload") {
    return (
      <form action={formAction} className={card} aria-busy={pending}>
        <StepHeading>1. Choose a CSV file</StepHeading>
        <p className="mt-2 text-ink-2">
          One guest per row, with a header row. Up to {CSV_LIMITS.rows.toLocaleString("en-US")}{" "}
          guests and 500 KB. In Excel or Google Sheets, save or download the sheet as CSV. Nothing
          is saved until you confirm.
        </p>
        {state.error ? (
          <Banner severity="critical" title="We couldn't use that file" className="mt-4">
            {state.error}
          </Banner>
        ) : null}
        <div className="mt-5 flex flex-col gap-1.5">
          <label htmlFor="import-file" className="text-sm font-semibold text-ink">
            CSV file
          </label>
          <input
            id="import-file"
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="min-h-11 w-full rounded-md border-[1.5px] border-line bg-field p-2 text-base file:mr-3 file:min-h-9 file:rounded-full file:border-0 file:bg-mist file:px-4 file:font-display file:font-bold"
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Submit intent="upload" pending={pending}>
            {pending ? "Reading the file…" : "Upload and continue"}
          </Submit>
          <Button asChild variant="ghost">
            <Link href={listHref}>Back to the guest list</Link>
          </Button>
        </div>
      </form>
    );
  }

  if (state.step === "map") {
    return (
      <form action={formAction} className={card} aria-busy={pending}>
        <Carry state={state} />
        <StepHeading>2. Match your columns</StepHeading>
        <p className="mt-2 text-ink-2">
          {state.fileName}:{" "}
          {state.rowCount === 1 ? "1 guest" : `${state.rowCount.toLocaleString("en-US")} guests`}.
          Choose where each column goes. We filled in the ones we recognised; check them. Name is
          required.
        </p>
        {state.errors?.length ? (
          <Banner severity="critical" title="Fix the matching to continue" className="mt-4">
            <ul className="list-disc pl-5">
              {state.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Banner>
        ) : null}
        <div
          role="region"
          aria-label="Columns in your file"
          tabIndex={0}
          className="relative mt-5 overflow-x-auto rounded-lg border border-line"
        >
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Columns in your file and the EventOps field each goes into
            </caption>
            <thead>
              <tr>
                <th scope="col" className={th}>
                  Column in your file
                </th>
                <th scope="col" className={th}>
                  Examples
                </th>
                <th scope="col" className={th}>
                  EventOps field
                </th>
              </tr>
            </thead>
            <tbody>
              {state.headers.map((header, i) => (
                <tr key={`${header}-${i}`}>
                  <th scope="row" className={`${td} min-w-36 text-left font-semibold`}>
                    <label htmlFor={`map-${i}`}>{header}</label>
                  </th>
                  <td className={`${td} min-w-40 text-ink-2`}>
                    {state.examples[i].join(", ") || "—"}
                  </td>
                  <td className={`${td} min-w-48`}>
                    <select
                      id={`map-${i}`}
                      name={`map-${i}`}
                      defaultValue={state.mapping[i] ?? ""}
                      className={fieldControlClass}
                    >
                      <option value="">Don&apos;t import</option>
                      {IMPORT_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {IMPORT_FIELD_LABEL[f]}
                          {REQUIRED_IMPORT_FIELDS.includes(f) ? " (required)" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Submit intent="preview" pending={pending}>
            {pending ? "Checking every row…" : "Preview the import"}
          </Submit>
          <Submit intent="restart" pending={pending} variant="ghost">
            Choose another file
          </Submit>
        </div>
      </form>
    );
  }

  if (state.step === "preview") {
    const { preview } = state;
    const fields = IMPORT_FIELDS.filter((f) => state.mapping.includes(f));
    const invalid = preview.rows.filter((r) => r.status === "invalid");
    const duplicates = preview.rows.filter((r) => r.status === "duplicate");
    const valid = preview.rows.filter((r) => r.status === "valid");
    const toImport = preview.totals.valid + (includeDuplicates ? preview.totals.duplicates : 0);
    const shown = valid.slice(0, PREVIEW_LIMIT);
    return (
      <form action={formAction} className="flex flex-col gap-6" aria-busy={pending}>
        <Carry state={state} />
        <input type="hidden" name="expected" value={toImport} />
        <section className={card} aria-labelledby="import-summary">
          <StepHeading>3. Check before importing</StepHeading>
          <h3 id="import-summary" className="sr-only">
            Summary
          </h3>
          {state.message ? (
            <Banner severity="warning" title="Nothing was imported yet" className="mt-4">
              {state.message}
            </Banner>
          ) : null}
          <dl className="mt-4 grid gap-4 sm:grid-cols-4">
            {[
              ["Rows in the file", preview.totals.rows],
              ["Will be imported", toImport],
              ["Need correction", preview.totals.invalid],
              ["Possible duplicates", preview.totals.duplicates],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-mist p-4">
                <dt className="text-sm font-semibold text-ink-2">{label}</dt>
                <dd className="font-display text-h3 font-extrabold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-ink-2">
            From {state.fileName}. Matched:{" "}
            {fields
              .map((f) => `${IMPORT_FIELD_LABEL[f]} ← ${state.headers[state.mapping.indexOf(f)]}`)
              .join(" · ")}
            .
            {preview.ignoredColumns.length
              ? ` Not imported: ${preview.ignoredColumns.join(", ").replace(/\.$/, "")}.`
              : ""}
          </p>
        </section>

        {invalid.length ? (
          <section className={card} aria-labelledby="import-invalid">
            <h3 id="import-invalid" className="text-h4 font-bold">
              Need correction ({invalid.length})
            </h3>
            <p className="mt-1 text-sm text-ink-2">
              These rows won&apos;t be imported. Fix them in your spreadsheet and import them later,
              or change the matching.
            </p>
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() => downloadRows(state.headers, invalid, state.fileName)}
            >
              Download these rows
            </Button>
            {rowsTable(invalid, fields, "Rows that need correction", (r) => r.errors.join(" "))}
          </section>
        ) : null}

        {duplicates.length ? (
          <section className={card} aria-labelledby="import-duplicates">
            <h3 id="import-duplicates" className="text-h4 font-bold">
              Possible duplicates ({duplicates.length})
            </h3>
            <p className="mt-1 text-sm text-ink-2">
              Same name, and the same email where both have one. Skipped unless you choose
              otherwise.
            </p>
            <label className="mt-3 flex min-h-11 items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                name="includeDuplicates"
                checked={includeDuplicates}
                onChange={(e) => setIncludeDuplicates(e.target.checked)}
                className="size-5 accent-blue"
              />
              Import possible duplicates anyway
            </label>
            {rowsTable(duplicates, fields, "Possible duplicates", (r) => r.duplicateOf ?? "")}
          </section>
        ) : null}

        <section className={card} aria-labelledby="import-valid">
          <h3 id="import-valid" className="text-h4 font-bold">
            Ready to import ({valid.length})
          </h3>
          {valid.length ? (
            <>
              {rowsTable(shown, fields, "Rows that will be imported")}
              {valid.length > shown.length ? (
                <p className="mt-2 text-sm text-ink-2">
                  And {valid.length - shown.length} more rows like these.
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-ink-2">No rows are ready yet.</p>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <Submit intent="confirm" pending={pending} disabled={toImport === 0}>
            {pending
              ? "Importing…"
              : toImport === 1
                ? "Import 1 attendee"
                : `Import ${toImport} attendees`}
          </Submit>
          <Submit intent="back" pending={pending} variant="secondary">
            Change the matching
          </Submit>
          <Submit intent="restart" pending={pending} variant="ghost">
            Start over
          </Submit>
        </div>
      </form>
    );
  }

  return (
    <div className={card}>
      <StepHeading>Import complete</StepHeading>
      <Banner
        severity="success"
        title={state.count === 1 ? "1 attendee was added" : `${state.count} attendees were added`}
        className="mt-4"
      >
        {state.count === 1 ? `As ${state.first}.` : `As ${state.first} to ${state.last}.`}
        {state.skipped
          ? ` ${state.skipped === 1 ? "1 row wasn't" : `${state.skipped} rows weren't`} imported.`
          : ""}{" "}
        The import is recorded in Activity.
      </Banner>
      <form action={formAction} className="mt-5 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={listHref}>Go to the guest list</Link>
        </Button>
        <Submit intent="restart" pending={pending} variant="secondary">
          Import another file
        </Submit>
      </form>
    </div>
  );
}