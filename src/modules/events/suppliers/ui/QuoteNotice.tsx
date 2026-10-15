// src/modules/events/suppliers/ui/QuoteNotice.tsx
// Success feedback on a supplier's page after adding (B4-09) or editing (B4-10) a quote. The page passes only a
// well-formed quote reference from the address, never other text from it. Dismissible; announced
// politely (SuccessMessage).
"use client";

import { useState } from "react";
import { SuccessMessage } from "@/components/shared/SuccessMessage";

// Only a type is exported besides the component: constants exported from a "use client" file
// become client references on the server (B3-04).
export type QuoteNoticeKind = "added" | "saved";

const TITLE: Record<QuoteNoticeKind, string> = { added: "Quote added", saved: "Quote saved" };

export function QuoteNotice({ kind, reference }: { kind: QuoteNoticeKind; reference: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <SuccessMessage title={TITLE[kind]} onDismiss={() => setVisible(false)}>
      <span className="font-mono">{reference}</span>{" "}
      {kind === "added" ? "is on this supplier's quotes." : "is up to date."}
    </SuccessMessage>
  );
}