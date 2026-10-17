// src/modules/events/tasks/ui/TaskNotice.tsx
// The confirmation shown after a task change (B6-F01 to B6-F03). A polite status message with an
// icon and words (the shared Banner), never colour alone. The title comes from the stored record,
// never from the address.
import { Banner } from "@/components/shared/Banner";

export type TaskNoticeKind = "task-added" | "task-saved" | "task-removed";

const VERB = { "task-added": "added", "task-saved": "saved", "task-removed": "removed" } as const;

export function TaskNotice({
  kind,
  reference,
  title,
}: {
  kind: TaskNoticeKind;
  reference: string;
  title?: string;
}) {
  const what = ["Task", reference, title ? `“${title}”` : null].filter(Boolean).join(" ");
  return <Banner severity="success" title={`${what} ${VERB[kind]}.`} />;
}