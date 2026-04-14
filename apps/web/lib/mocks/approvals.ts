/**
 * Mock approval data for development and fallback.
 */

import type { PendingApprovalItem } from "@/types/api";

export function mockPendingApprovals(): PendingApprovalItem[] {
  return [
    {
      workflow_id: "wf_inc_20260408_42",
      incident_id: "inc_20260408_42",
      title: "Payments latency spike",
      severity: "high",
      confidence: 0.9,
      recommendation: "Review and approve automated remediation window.",
      time_queued: new Date().toISOString(),
    },
  ];
}
