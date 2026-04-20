/**
 * Dashboard API service.
 * Handles fetching dashboard summary and aggregated data.
 */

import type { DashboardSummaryResponse } from "@/types/api";
import { MAIN_TABS_ALLOW_FALLBACK } from "@/lib/config";
import { mockDashboardSummary } from "@/lib/mocks/dashboard";
import { fetchWithFallback } from "@/lib/services/serviceFetch";

export async function getDashboardSummary(): Promise<DashboardSummaryResponse> {
  return fetchWithFallback<DashboardSummaryResponse>({
    path: "/api/v1/dashboard/summary",
    fallbackFactory: mockDashboardSummary,
    warningMessage: "[api] Could not fetch dashboard summary, using mock data.",
    allowFallback: MAIN_TABS_ALLOW_FALLBACK,
  });
}
