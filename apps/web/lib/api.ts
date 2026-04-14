/**
 * API client — unified export of all API services and types.
 * Implementation is split into focused modules for maintainability.
 */

// Re-export types
export type {
  IncidentSummary,
  DashboardSummaryResponse,
  ApprovalPayload,
  ApprovalEvent,
  PendingApprovalItem,
  MonitoringService,
  MonitoringOverview,
  SettingsSnapshot,
  RuntimeConfigPayload,
  RuntimeConfigResponse,
  RuntimeConnectivityResponse,
  SupportResourcesResponse,
  WasteDemoResponse,
} from "@/types/api";

// Re-export service functions
export { listIncidents, getIncidentDetail } from "@/lib/services/incidents";
export { getDashboardSummary } from "@/lib/services/dashboard";
export { submitApproval, listApprovals } from "@/lib/services/traces";
export { listPendingApprovals, quickResolvePendingApprovals } from "@/lib/services/approvals";
export { getMonitoringOverview } from "@/lib/services/monitoring";
export { getSettingsSnapshot, updateRuntimeConfig, checkRuntimeConnections } from "@/lib/services/settings";
export { getSupportResources } from "@/lib/services/support";
export { getWasteDemo, getWasteDemoLocal, getWasteLive } from "@/lib/services/waste";
