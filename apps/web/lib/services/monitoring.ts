/**
 * Monitoring API service.
 * Handles fetching monitoring and system health data.
 */

import type { MonitoringOverview } from "@/types/api";
import { USE_MOCK_FALLBACK } from "@/lib/config";
import { apiFetch, canFallback } from "@/lib/http";
import { mockMonitoringOverview } from "@/lib/mocks/monitoring";

export async function getMonitoringOverview(): Promise<MonitoringOverview> {
  if (USE_MOCK_FALLBACK) {
    return mockMonitoringOverview();
  }

  try {
    return await apiFetch<MonitoringOverview>("/api/v1/monitoring/overview");
  } catch (err) {
    if (!canFallback()) {
      throw err;
    }
    console.warn("[api] Could not fetch monitoring overview, using mock data.", err);
    return mockMonitoringOverview();
  }
}
