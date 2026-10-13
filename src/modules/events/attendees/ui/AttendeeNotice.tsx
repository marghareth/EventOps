// src/modules/events/attendees/ui/AttendeeNotice.tsx
// Success feedback on the guest list after adding (B2-02) or editing (B2-03) an attendee.
// Dismissible; announced politely to screen readers (SuccessMessage).
"use client";

import { useState } from "react";
import { SuccessMessage } from "@/components/shared/SuccessMessage";

type AttendeeNoticeProps = {
  kind: "added" | "saved";
  reference: string;
  /** From the stored attendee, never from the URL. */
  name?: string;
};

export function AttendeeNotice({ kind, reference, name }: AttendeeNoticeProps) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  const id = <span className="font-mono">{reference}</span>;
  return (
    <SuccessMessage
      title={kind === "added" ? "Attendee added" : "Changes saved"}
      onDismiss={() => setVisible(false)}
    >
      {kind === "added" ? (
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