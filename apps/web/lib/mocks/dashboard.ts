/**
 * Mock dashboard summary data for development and fallback.
 */

import type { DashboardSummaryResponse } from "@/types/api";
import { mockIncidents } from "@/lib/mocks/incidents";

export function mockDashboardSummary(): DashboardSummaryResponse {
  const items = mockIncidents();
  return {
    stats: {
      active_incidents: items.length,
      pending_approvals: items.filter((item) => item.status === "pending_approval").length,
      avg_confidence: 0.82,
      source_indexes: ["tutorial"],
      last_updated: new Date().toISOString(),
    },
    items,
  };
}
