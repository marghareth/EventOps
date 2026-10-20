// src/modules/events/impact/public.ts
// The impact context's public interface (B7; D-001, D-101). Pages import from here only. Server
// actions are not re-exported: the forms import them from the module directly.
export { getImpactWorkspace } from "./queries";
export { IMPACT_NOTICES } from "./form-state";
export { AssumptionsForm } from "./ui/AssumptionsForm";
export { AssumptionsSummary } from "./ui/AssumptionsSummary";
export { ImpactHistory } from "./ui/ImpactHistory";
export { ImpactList } from "./ui/ImpactList";
export { ImpactNotice } from "./ui/ImpactNotice";
export { ImpactSimulator } from "./ui/ImpactSimulator";
export { ImpactSummary } from "./ui/ImpactSummary";
export { SaveAnalysisButton } from "./ui/SaveAnalysisButton";

/** @public The page's read result: the contract the Impact page builds on. */
export type { ImpactWorkspace } from "./queries";