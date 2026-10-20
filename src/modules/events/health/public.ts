// src/modules/events/health/public.ts
// The Event Health context's public interface (B8; D-001, D-105 to D-107). Pages import from here only.
export { getEventHealth } from "./queries";
export { HealthCheckList } from "./ui/HealthCheckList";
export { HealthIssueList } from "./ui/HealthIssueList";
export { HealthStatusPanel } from "./ui/HealthStatusPanel";
export { HealthSummaryTiles } from "./ui/HealthSummaryTiles";
export { RecentActivityList } from "./ui/RecentActivityList";

/** @public The read result: the contract the Overview and Health pages build on. */
export type { EventHealth } from "./queries";