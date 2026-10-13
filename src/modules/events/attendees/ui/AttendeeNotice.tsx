// src/modules/events/attendees/ui/AttendeeNotice.tsx
// Success feedback on the guest list after adding (B2-02), editing (B2-03) or removing (B2-04) an
// attendee.
// Dismissible; announced politely to screen readers (SuccessMessage).
"use client";

import { useState } from "react";
import { SuccessMessage } from "@/components/shared/SuccessMessage";

type AttendeeNoticeProps = {
  kind: "added" | "saved" | "removed";
  reference: string;
  /** From the stored attendee, never from the URL. Not available after removing. */
  name?: string;
};

const TITLE = {
  added: "Attendee added",
  saved: "Changes saved",
  removed: "Attendee removed",
} as const;

export function AttendeeNotice({ kind, reference, name }: AttendeeNoticeProps) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  const id = <span className="font-mono">{reference}</span>;
  return (
    <SuccessMessage title={TITLE[kind]} onDismiss={() => setVisible(false)}>
      {kind === "removed" ? (
        <>{id} is no longer on the guest list.</>
      ) : kind === "added" ? (
        name ? (
          <>
            {name} is on the guest list as {id}.
          </>
        ) : (
          <>Added to the guest list as {id}.</>
        )
      ) : name ? (
        <>
          {name} ({id}) is up to date.
        </>
      ) : (
        <>{id} is up to date.</>
      )}
    </SuccessMessage>
  );
}