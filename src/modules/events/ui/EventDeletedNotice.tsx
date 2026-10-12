// src/modules/events/ui/EventDeletedNotice.tsx
// Shown on My events after B1-06 deletes an event. Dismissible.
"use client";

import { useState } from "react";
import { SuccessMessage } from "@/components/shared/SuccessMessage";

export function EventDeletedNotice({ reference }: { reference: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <SuccessMessage title="Event deleted" onDismiss={() => setVisible(false)}>
      <span className="font-mono">{reference}</span> and everything in it were permanently deleted.
    </SuccessMessage>
  );
}