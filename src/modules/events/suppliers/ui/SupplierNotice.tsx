// src/modules/events/suppliers/ui/SupplierNotice.tsx
// Success feedback on the supplier list after adding (B4-03), editing (B4-04) or removing (B4-05) a
// supplier. The page passes only a well-formed reference from the address and, when known, the
// stored supplier's name, never text from the address. Dismissible; announced politely
// (SuccessMessage).
"use client";

import { useState } from "react";
import { SuccessMessage } from "@/components/shared/SuccessMessage";

// Only a type is exported besides the component: constants exported from a "use client" file
// become client references on the server (B3-04).
export type SupplierNoticeKind = "added" | "saved" | "removed";

const TITLE: Record<SupplierNoticeKind, string> = {
  added: "Supplier added",
  saved: "Changes saved",
  removed: "Supplier removed",
};

export function SupplierNotice({
  kind,
  reference,
  name,
}: {
  kind: SupplierNoticeKind;
  reference: string;
  /** From the stored supplier, never from the address. Not available after removing. */
  name?: string;
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  const id = <span className="font-mono">{reference}</span>;
  return (
    <SuccessMessage title={TITLE[kind]} onDismiss={() => setVisible(false)}>
      {kind === "removed" ? (
        <>{id} is no longer on the supplier list.</>
      ) : kind === "added" ? (
        name ? (
          <>
            {name} is on the supplier list as {id}.
          </>
        ) : (
          <>Added to the supplier list as {id}.</>
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