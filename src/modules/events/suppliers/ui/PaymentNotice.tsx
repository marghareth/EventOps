// src/modules/events/suppliers/ui/PaymentNotice.tsx
// Success feedback on a supplier's page after adding or editing a payment (B4-14). The page passes
// only a well-formed payment reference from the address, never other text from it. Dismissible;
// announced politely (SuccessMessage).
"use client";

import { useState } from "react";
import { SuccessMessage } from "@/components/shared/SuccessMessage";

// Only a type is exported besides the component: constants exported from a "use client" file
// become client references on the server (B3-04).
export type PaymentNoticeKind = "added" | "saved";

const TITLE: Record<PaymentNoticeKind, string> = { added: "Payment added", saved: "Payment saved" };

export function PaymentNotice({ kind, reference }: { kind: PaymentNoticeKind; reference: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <SuccessMessage title={TITLE[kind]} onDismiss={() => setVisible(false)}>
      <span className="font-mono">{reference}</span>{" "}
      {kind === "added" ? "is on this supplier's payments." : "is up to date."}
    </SuccessMessage>
  );
}