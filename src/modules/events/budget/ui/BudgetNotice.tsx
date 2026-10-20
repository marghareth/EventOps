// src/modules/events/budget/ui/BudgetNotice.tsx
// The confirmation shown after a budget change (B5-F01, B5-F02). Uses the shared success message
// (B10-F08, F16): announced to screen readers (role="status") with an icon and words, never colour
// alone. The name comes from the stored record, never from the address.
import { SuccessMessage } from "@/components/shared/SuccessMessage";

export type BudgetNoticeKind =
  | "category-added"
  | "category-saved"
  | "category-removed"
  | "item-added"
  | "item-saved"
  | "item-removed";

const VERB = { added: "added", saved: "saved", removed: "removed" } as const;

function sentence(kind: BudgetNoticeKind, name?: string, reference?: string) {
  const [subject, action] = kind.split("-") as ["category" | "item", keyof typeof VERB];
  const what =
    subject === "category"
      ? ["Category", name ? `“${name}”` : null]
      : ["Budget item", reference ?? null, name ? `“${name}”` : null];
  return `${what.filter(Boolean).join(" ")} ${VERB[action]}.`;
}

export function BudgetNotice({
  kind,
  name,
  reference,
}: {
  kind: BudgetNoticeKind;
  name?: string;
  reference?: string;
}) {
  return <SuccessMessage title={sentence(kind, name, reference)} />;
}