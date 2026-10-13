// src/modules/events/attendees/ui/AttendeeAddedNotice.tsx
// Success feedback on the guest list after adding an attendee (B2-02). Dismissible; announced
// politely to screen readers (SuccessMessage).
"use client";

import { useState } from "react";
import { SuccessMessage } from "@/components/shared/SuccessMessage";

export function AttendeeAddedNotice({ reference, name }: { reference: string; name?: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <SuccessMessage title="Attendee added" onDismiss={() => setVisible(false)}>
      {name ? <>{name} is on the guest list as </> : <>Added to the guest list as </>}
      <span className="font-mono">{reference}</span>.
    </SuccessMessage>
  );
}