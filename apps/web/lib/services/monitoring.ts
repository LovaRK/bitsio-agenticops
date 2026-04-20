/**
 * Monitoring API service.
 * Handles fetching monitoring and system health data.
 */

import type { MonitoringOverview } from "@/types/api";
import { mockMonitoringOverview } from "@/lib/mocks/monitoring";
import { fetchWithFallback } from "@/lib/services/serviceFetch";

export async function getMonitoringOverview(): Promise<MonitoringOverview> {
  return fetchWithFallback<MonitoringOverview>({
    path: "/api/v1/monitoring/overview",
    fallbackFactory: mockMonitoringOverview,
    warningMessage: "[api] Could not fetch monitoring overview, using mock data.",
  });
}
