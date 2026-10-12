// src/modules/events/ui/EventCreatedNotice.tsx
// Success feedback shown on the new event's workspace after B1-02 creates it. Dismissible.
"use client";

import { useState } from "react";
import { SuccessMessage } from "@/components/shared/SuccessMessage";

export function EventCreatedNotice({ reference }: { reference: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <SuccessMessage title="Event created" onDismiss={() => setVisible(false)} className="mb-6">
      Your event is ready as <span className="font-mono">{reference}</span>. You are its Owner.
    </SuccessMessage>
  );
}