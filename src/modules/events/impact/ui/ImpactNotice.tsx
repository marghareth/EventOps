// src/modules/events/impact/ui/ImpactNotice.tsx
// The confirmation shown after an impact change (B7-F11, B7-F12). A polite status message with an
// icon and words (the shared Banner). The reference is checked by the page before it is shown.
import { Banner } from "@/components/shared/Banner";
import type { ImpactNoticeKind } from "../form-state";

export function ImpactNotice({ kind, reference }: { kind: ImpactNoticeKind; reference?: string }) {
  if (kind === "analysis-saved") {
    const what = reference ? `Analysis ${reference}` : "The analysis";
    return <Banner severity="success" title={`${what} was saved to the history.`} />;
  }
  if (kind === "assumptions-unchanged") {
    return <Banner severity="info" title="Nothing changed, so nothing was saved." />;
  }
  return <Banner severity="success" title="Assumptions saved." />;
}