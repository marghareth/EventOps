// src/components/shared/EmptyState.tsx
import type { ReactNode } from "react";
import { StatePanel } from "./StatePanel";

type EmptyStateProps = {
  /** Say what is missing, for example "No suppliers yet". */
  title: string;
  /** Say what to do next, for example "Import your spreadsheet or add your first supplier." */
  description?: ReactNode;
  /** One clear next step: a Button or a Link. */
  action?: ReactNode;
  headingLevel?: 1 | 2 | 3;
};

export function EmptyState({ title, description, action, headingLevel }: EmptyStateProps) {
  return (
    <StatePanel icon="empty" title={title} description={description} headingLevel={headingLevel}>
      {action}
    </StatePanel>
  );
}