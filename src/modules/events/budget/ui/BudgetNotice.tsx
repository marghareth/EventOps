// src/modules/events/budget/ui/BudgetNotice.tsx
// The confirmation shown after a budget change (B5-F01, B5-F02). Announced to screen readers
// (role="status") and never relies on colour alone: it carries an icon and words. The name comes
// from the stored record, never from the address.
// The icon is an inline SVG (the Lucide "circle-check" shape from the brand book), so this file
// needs no icon package.

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 size-5 shrink-0 text-[#1B7F4B]"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

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
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-[#A9DCC0] bg-[#E2F4EA] p-4 text-foreground"
    >
      <CheckIcon />
      <p className="text-sm font-medium">{sentence(kind, name, reference)}</p>
    </div>
  );
}