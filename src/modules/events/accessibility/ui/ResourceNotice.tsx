// src/modules/events/accessibility/ui/ResourceNotice.tsx
// Success feedback on the Accessibility page after saving or removing a resource (B3-05). The page
// passes only checked values; the label comes from the canonical definitions, never the address.
"use client";

import { useState } from "react";
import { SuccessMessage } from "@/components/shared/SuccessMessage";
import { RESOURCE_TYPE_DEFINITIONS, type ResourceType } from "../domain/resource";
import type { ResourceNoticeKind } from "../notices";

export function ResourceNotice({ kind, type }: { kind: ResourceNoticeKind; type: ResourceType }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  const label = RESOURCE_TYPE_DEFINITIONS[type].label;
  return (
    <SuccessMessage
      title={kind === "saved" ? "Resource saved" : "Resource removed"}
      onDismiss={() => setVisible(false)}
    >
      {kind === "saved" ? `${label} is up to date.` : `${label} is not set up any more.`}
    </SuccessMessage>
  );
}