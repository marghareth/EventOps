// src/modules/events/import/ui/ImportWizard.tsx
// The import steps (B9-F01 to F21; D-052, D-109 to D-112): choose what to import and a CSV or Excel
// file, match the columns (suggested by the AI or by rules, always checked by the user), preview
// every row, confirm, result. Each step posts to one server action, which re-checks everything;
// this component only shows the state it returns. The file's rows travel as text in a hidden field
// between steps. Headings move focus so screen readers hear each new step.
"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/shared/Banner";
import { fieldControlClass } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { COLUMN_TYPE_LABEL } from "../domain/column-types";
import { IMPORT_TYPES, type ImportType } from "../domain/file-policy";
import {
  IMPORT_TYPE_WORDS,
  initialImportState,
  type FieldOption,
  type ImportState,
  type PreviewRowView,
  type SuggestionNotice,
} from "../import-state";

type Action = (state: ImportState, formData: FormData) => Promise<ImportState>;

type Props = {
  action: Action;
  /** Where each list lives, for "Back to" and "Go to" links. */
  listHrefs: Record<ImportType, string>;
  /** Preselected on the first step, for example from the Suppliers page. */
  initialType?: ImportType;
  maxRows: number;
};

type FileState = Extract<ImportState, { csv: string }>;

const card = "rounded-xl bg-white p-6 shadow-xs sm:p-8";
const th =
  "bg-mist px-3 py-3 text-left font-display text-xs font-bold tracking-wider whitespace-nowrap text-ink-2 uppercase";
const td = "border-t border-line px-3 py-3 align-top break-words";
const PREVIEW_LIMIT = 100;

const count = (n: number, one: string, many: string) =>
  n === 1 ? `1 ${one}` : `${n.toLocaleString("en-US")} ${many}`;

function StepHeading({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <h2 ref={ref} tabIndex={-1} className="text-h3 font-bold outline-none">
      {children}
    </h2>
  );
}

/** Hidden fields that carry the file, its type and the mapping to the next step. */
function Carry({ state }: { state: FileState }) {
  return (
    <>
      <input type="hidden" name="importType" value={state.importType} />
      <input type="hidden" name="csv" value={state.csv} />
      <input type="hidden" name="fileName" value={state.fileName} />
      <input type="hidden" name="fileType" value={state.fileType} />
      <input type="hidden" name="aiSuggested" value={String(state.aiSuggested)} />
      {state.sheet ? <input type="hidden" name="sheet" value={state.sheet} /> : null}
      {state.sheets ? (
        <input type="hidden" name="sheets" value={JSON.stringify(state.sheets)} />
      ) : null}
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
  fields: readonly FieldOption[],
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
              <th key={f.id} scope="col" className={th}>
                {f.label}
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
                <td key={f.id} className={`${td} max-w-64 min-w-28 text-ink-2`}>
                  {/* Rows that will be saved show what will be saved; others show the file's value. */}
                  {(row.saved ? row.saved[f.id] : row.values[f.id]) || (
                    <span aria-label="empty">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function download(csv: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `needs-correction-${fileName.replace(/\.(csv|xlsx)$/i, "")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** How the matching was suggested (D-111, D-112). Never claims more than happened. */
function NoticeBanner({ notice }: { notice: SuggestionNotice }) {
  if (notice.source === "ai") {
    return (
      <Banner severity="info" title="Suggested by AI" className="mt-4">
        An open-weight model, {notice.model}, suggested the matching from your column headers and a
        few example values. Check every column: nothing is saved until you confirm, and every row is
        checked by EventOps&apos;s own rules.
      </Banner>
    );
  }
  return (
    <Banner
      severity="info"
      title={
        notice.fallback === "rejected"
          ? "Matched by rules: the AI suggestion didn't pass our checks"
          : "Matched by rules: AI wasn't available"
      }
      className="mt-4"
    >
      We matched the columns from their headers and the kind of values they hold. Check every column
      before previewing.
    </Banner>
  );
}

export function ImportWizard({ action, listHrefs, initialType = "attendees", maxRows }: Props) {
  const [state, formAction, pending] = useActionState(action, initialImportState);
  // The checkbox follows the latest preview until the user changes it for that preview.
  const [choice, setChoice] = useState<{ for: ImportState; value: boolean } | null>(null);
  const includeDuplicates =
    choice?.for === state ? choice.value : state.step === "preview" && state.includeDuplicates;
  const setIncludeDuplicates = (value: boolean) => setChoice({ for: state, value });

  if (state.step === "upload") {
    const selected = state.importType ?? initialType;
    const words = IMPORT_TYPE_WORDS[selected];
    return (
      // Keyed so a new state's defaults (type, sheet) replace the mounted form's values.
      <form
        key={`${selected}|${state.sheets?.join("|") ?? ""}|${state.sheet ?? ""}`}
        action={formAction}
        className={card}
        aria-busy={pending}
      >
        <StepHeading>1. Choose a file</StepHeading>
        <p className="mt-2 text-ink-2">
          A CSV or Excel (.xlsx) file with a header row and one entry per row. Up to{" "}
          {maxRows.toLocaleString("en-US")} rows; CSV up to 500 KB, Excel up to 750 KB (the values
          in one sheet are read). Nothing is saved until you confirm, and the file isn&apos;t kept.
        </p>
        {state.error ? (
          <Banner severity="critical" title="We couldn't use that file" className="mt-4">
            {state.error}
          </Banner>
        ) : null}
        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-ink">What are you importing?</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {IMPORT_TYPES.map((type) => (
              <label
                key={type}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border-[1.5px] border-line p-3 has-checked:border-blue has-checked:bg-blue-tint"
              >
                <input
                  type="radio"
                  name="importType"
                  value={type}
                  defaultChecked={type === selected}
                  className="mt-0.5 size-5 accent-blue"
                />
                <span>
                  <span className="block font-semibold">{IMPORT_TYPE_WORDS[type].title}</span>
                  <span className="block text-sm text-ink-2">{IMPORT_TYPE_WORDS[type].hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 flex flex-col gap-1.5">
          <label htmlFor="import-file" className="text-sm font-semibold text-ink">
            CSV or Excel file
          </label>
          <input
            id="import-file"
            type="file"
            name="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="min-h-11 w-full rounded-md border-[1.5px] border-line bg-field p-2 text-base file:mr-3 file:min-h-9 file:rounded-full file:border-0 file:bg-mist file:px-4 file:font-display file:font-bold"
          />
        </div>
        {state.sheets?.length ? (
          <div className="mt-5 flex flex-col gap-1.5">
            <label htmlFor="import-sheet" className="text-sm font-semibold text-ink">
              Sheet to read
            </label>
            <select
              id="import-sheet"
              name="sheet"
              defaultValue={state.sheet ?? state.sheets[0]}
              className={fieldControlClass}
              aria-describedby="import-sheet-hint"
            >
              {state.sheets.map((sheet) => (
                <option key={sheet} value={sheet}>
                  {sheet}
                </option>
              ))}
            </select>
            <input type="hidden" name="sheets" value={JSON.stringify(state.sheets)} />
            <p id="import-sheet-hint" className="text-sm text-ink-2">
              Choose the sheet, then choose the same file again.
            </p>
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Submit intent="upload" pending={pending}>
            {pending ? "Reading the file…" : "Upload and continue"}
          </Submit>
          <Button asChild variant="ghost">
            <Link href={listHrefs[selected]}>Back to the {words.list}</Link>
          </Button>
        </div>
      </form>
    );
  }

  if (state.step === "map") {
    const words = IMPORT_TYPE_WORDS[state.importType];
    const required = state.fields.filter((f) => f.required).map((f) => f.label);
    const other = state.looksLike;
    return (
      // Keyed so a new suggestion (after switching type) replaces the selects' mounted values.
      <form
        key={`${state.importType}|${state.mapping.join("|")}`}
        action={formAction}
        className={card}
        aria-busy={pending}
      >
        <Carry state={state} />
        <StepHeading>2. Match your columns</StepHeading>
        <p className="mt-2 text-ink-2">
          Importing <strong className="text-ink">{words.many}</strong> from {state.fileName}
          {state.sheet ? ` (sheet “${state.sheet}”)` : ""}: {count(state.rowCount, "row", "rows")}.
          Choose where each column goes. Required: {required.join(" and ")}.
        </p>
        {state.notice ? <NoticeBanner notice={state.notice} /> : null}
        {other ? (
          <Banner
            severity="warning"
            title={`These columns look like a ${IMPORT_TYPE_WORDS[other].list}`}
            className="mt-4"
            action={
              <Button
                type="submit"
                name="intent"
                value="switch-type"
                variant="secondary"
                disabled={pending}
              >
                {`Import as ${IMPORT_TYPE_WORDS[other].many} instead`}
              </Button>
            }
          >
            You chose {words.many}. If that&apos;s right, carry on.
            <input type="hidden" name="switchTo" value={other} />
          </Banner>
        ) : null}
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
                  Looks like
                </th>
                <th scope="col" className={th}>
                  EventOps field
                </th>
              </tr>
            </thead>
            <tbody>
              {state.headers.map((header, i) => {
                const byAi =
                  state.notice?.source === "ai" && state.suggested?.[i] && state.mapping[i];
                return (
                  <tr key={`${header}-${i}`}>
                    <th scope="row" className={`${td} min-w-36 text-left font-semibold`}>
                      <label htmlFor={`map-${i}`}>{header}</label>
                    </th>
                    <td className={`${td} min-w-40 text-ink-2`}>
                      {state.examples[i].join(", ") || "—"}
                    </td>
                    <td className={`${td} min-w-28 whitespace-nowrap text-ink-2`}>
                      {COLUMN_TYPE_LABEL[state.columnTypes[i]]}
                    </td>
                    <td className={`${td} min-w-48`}>
                      <select
                        id={`map-${i}`}
                        name={`map-${i}`}
                        defaultValue={state.mapping[i] ?? ""}
                        className={fieldControlClass}
                        aria-describedby={byAi ? `map-${i}-ai` : undefined}
                      >
                        <option value="">Don&apos;t import</option>
                        {state.fields.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                            {f.required ? " (required)" : ""}
                          </option>
                        ))}
                      </select>
                      {byAi ? (
                        <p id={`map-${i}-ai`} className="mt-1 text-xs text-ink-3">
                          Suggested by AI
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Submit intent="preview" pending={pending}>
            {pending ? "Checking every row…" : "Preview the import"}
          </Submit>
          {state.sheets ? (
            <Submit intent="pick-sheet" pending={pending} variant="secondary">
              Choose another sheet
            </Submit>
          ) : null}
          <Submit intent="restart" pending={pending} variant="ghost">
            Choose another file
          </Submit>
        </div>
      </form>
    );
  }

  if (state.step === "preview") {
    const { preview } = state;
    const words = IMPORT_TYPE_WORDS[state.importType];
    const fields = state.fields.filter((f) => state.mapping.includes(f.id));
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
            {words.title} from {state.fileName}
            {state.sheet ? ` (sheet “${state.sheet}”)` : ""}. Matched:{" "}
            {fields
              .map((f) => `${f.label} ← ${state.headers[state.mapping.indexOf(f.id)]}`)
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
              onClick={() => download(state.correctionCsv, state.fileName)}
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
              {state.importType === "attendees"
                ? "Same name, and the same email where both have one."
                : "Same name as a supplier already added or earlier in the file."}{" "}
              Skipped unless you choose otherwise.
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
            {pending ? "Importing…" : `Import ${count(toImport, words.one, words.many)}`}
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

  const words = IMPORT_TYPE_WORDS[state.importType];
  return (
    <div className={card}>
      <StepHeading>Import complete</StepHeading>
      <Banner
        severity="success"
        title={`${count(state.count, words.one, words.many)} ${state.count === 1 ? "was" : "were"} added`}
        className="mt-4"
      >
        {state.count === 1 ? `As ${state.first}.` : `As ${state.first} to ${state.last}.`}
        {state.skipped
          ? ` ${state.skipped === 1 ? "1 row wasn't" : `${state.skipped} rows weren't`} imported.`
          : ""}{" "}
        The import is recorded in Activity.
      </Banner>
      <form action={formAction} className="mt-5 flex flex-wrap gap-3">
        <input type="hidden" name="importType" value={state.importType} />
        <Button asChild>
          <Link href={listHrefs[state.importType]}>Go to the {words.list}</Link>
        </Button>
        <Submit intent="restart" pending={pending} variant="secondary">
          Import another file
        </Submit>
      </form>
    </div>
  );
}