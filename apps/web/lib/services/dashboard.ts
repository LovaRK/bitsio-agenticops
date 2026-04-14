/**
 * Dashboard API service.
 * Handles fetching dashboard summary and aggregated data.
 */

import type { DashboardSummaryResponse } from "@/types/api";
import { USE_MOCK_FALLBACK } from "@/lib/config";
import { apiFetch, canFallback } from "@/lib/http";
import { mockDashboardSummary } from "@/lib/mocks/dashboard";

export async function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  if (USE_MOCK_FALLBACK) {
    return mockDashboardSummary();
  }

  try {
    return await apiFetch<DashboardSummaryResponse>("/api/v1/dashboard/summary");
  } catch (err) {
    if (!canFallback()) {
      throw err;
    }
    console.warn("[api] Could not fetch dashboard summary, using mock data.", err);
    return mockDashboardSummary();
  }
}
