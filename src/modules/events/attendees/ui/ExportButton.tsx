// src/modules/events/attendees/ui/ExportButton.tsx
// "Export CSV" with feedback (B2-22, D-053). A real link to the export route, so it works without
// JavaScript. With JavaScript it downloads in the background, then says what was downloaded, or
// shows the server's safe error message in a banner instead of a raw JSON page.
"use client";

import { useState } from "react";
import { Banner } from "@/components/shared/Banner";
import { Button } from "@/components/ui/button";
import { parseCsv } from "../csv";

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; fileName: string; count: number }
  | { kind: "error"; message: string };

const FALLBACK_ERROR = "We couldn't export the guest list. Try again in a moment.";

/** The file name from Content-Disposition, e.g. EVT-2026-0001-attendees-2026-10-13.csv. */
function fileNameFrom(header: string | null): string {
  return /filename="([^"]+)"/.exec(header ?? "")?.[1] ?? "attendees.csv";
}

export function ExportButton({ href }: { href: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function download(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (state.kind === "busy") return;
    setState({ kind: "busy" });
    try {
      const response = await fetch(href, { credentials: "same-origin" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setState({ kind: "error", message: body?.error ?? FALLBACK_ERROR });
        return;
      }
      const blob = await response.blob();
      // Count with the real parser: notes can contain line breaks, even CRLF ones.
      const parsed = parseCsv(await blob.text());
      const count = parsed.ok ? parsed.table.rows.length : 0;
      const fileName = fileNameFrom(response.headers.get("content-disposition"));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setState({ kind: "done", fileName, count });
    } catch {
      setState({ kind: "error", message: FALLBACK_ERROR });
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${state.kind === "error" ? "basis-full" : ""}`}>
      <Button asChild variant="secondary">
        <a href={href} download onClick={download} aria-busy={state.kind === "busy"}>
          {state.kind === "busy" ? "Preparing the file…" : "Export CSV"}
        </a>
      </Button>
      <p role="status" className="text-sm text-ink-2 empty:hidden">
        {state.kind === "done"
          ? `Downloaded ${state.fileName} (${state.count === 1 ? "1 attendee" : `${state.count} attendees`}).`
          : ""}
      </p>
      {state.kind === "error" ? (
        <Banner
          severity="critical"
          title="Export didn't work"
          onDismiss={() => setState({ kind: "idle" })}
        >
          {state.message}
        </Banner>
      ) : null}
    </div>
  );
}