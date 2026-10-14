// src/modules/events/accessibility/ui/AccessibilityNotice.tsx
// Success feedback on the attendee details page after adding, editing or removing an accessibility
// need (B3-04). The page passes only checked values: a known notice kind and a known type, whose
// label comes from the canonical definitions, never from the address. Dismissible; announced
// politely to screen readers (SuccessMessage).
"use client";

import { useState } from "react";
import { SuccessMessage } from "@/components/shared/SuccessMessage";
import { REQUIREMENT_TYPE_DEFINITIONS, type RequirementType } from "../domain/requirement-type";
import type { AccessibilityNoticeKind } from "../notices";

const TITLE: Record<AccessibilityNoticeKind, string> = {
  added: "Accessibility need added",
  saved: "Changes saved",
  removed: "Accessibility need removed",
};

const TEXT: Record<AccessibilityNoticeKind, (label: string) => string> = {
  added: (label) => `${label} is now on this guest's accessibility needs.`,
  saved: (label) => `${label} is up to date.`,
  removed: (label) => `${label} is no longer on this guest's accessibility needs.`,
};

export function AccessibilityNotice({
  kind,
  type,
}: {
  kind: AccessibilityNoticeKind;
  type: RequirementType;
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <SuccessMessage title={TITLE[kind]} onDismiss={() => setVisible(false)}>
      {TEXT[kind](REQUIREMENT_TYPE_DEFINITIONS[type].label)}
    </SuccessMessage>
  );
}