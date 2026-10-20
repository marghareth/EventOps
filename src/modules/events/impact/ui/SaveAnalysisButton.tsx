// src/modules/events/impact/ui/SaveAnalysisButton.tsx
// Saves the analysis on screen to the history (B7-F11; D-103). Shown only to Owners and
// Coordinators; the server action checks the role again, runs the analysis again from stored data,
// and refuses it if the event or the assumptions changed since this page was loaded.
"use client";

import { useActionState } from "react";
import { Banner } from "@/components/shared/Banner";
import { Button } from "@/components/ui/button";
import { saveAnalysisAction } from "../actions";
import type { SaveAnalysisState } from "../form-state";

const IDLE: SaveAnalysisState = { status: "idle" };

export function SaveAnalysisButton({
  eventId,
  from,
  to,
  version,
}: {
  eventId: string;
  from: number;
  to: number;
  /** The assumptions' edit version this analysis used, or "". */
  version: string;
}) {
  const [state, formAction, pending] = useActionState(saveAnalysisAction.bind(null, eventId), IDLE);
  return (
    <form action={formAction} aria-busy={pending} className="flex flex-col gap-3">
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="version" value={version} />
      {state.status === "error" ? (
        <Banner severity="critical" title="Couldn't save the analysis">
          {state.message}
        </Banner>
      ) : null}
      <div>
        <Button type="submit" variant="outline" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Saving…" : "Save to history"}
        </Button>
      </div>
    </form>
  );
}