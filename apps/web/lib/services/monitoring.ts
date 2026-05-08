/**
 * Monitoring API service.
 * Handles fetching monitoring and system health data.
 */

import type { MonitoringOverview } from "@/types/api";
import { MAIN_TABS_ALLOW_FALLBACK } from "@/lib/config";
import { mockMonitoringOverview } from "@/lib/mocks/monitoring";
import { fetchWithFallback } from "@/lib/services/serviceFetch";

export async function getMonitoringOverview(): Promise<MonitoringOverview> {
  return fetchWithFallback<MonitoringOverview>({
    path: "/api/v1/monitoring/overview",
    fallbackFactory: mockMonitoringOverview,
    warningMessage: "[api] Could not fetch monitoring overview, using mock data.",
    allowFallback: MAIN_TABS_ALLOW_FALLBACK,
    timeoutMs: 30000,
    timeoutLabel: "monitoring-overview",
  });
}
