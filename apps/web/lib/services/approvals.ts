/**
 * Approval API service.
 * Handles fetching and managing approval workflow data.
 */

import type { PendingApprovalItem } from "@/types/api";
import { ACTION_TIMEOUT_MS, MAIN_TABS_ALLOW_FALLBACK, PAGE_FETCH_TIMEOUT_MS } from "@/lib/config";
import { mockPendingApprovals } from "@/lib/mocks/approvals";
import { fetchWithFallback } from "@/lib/services/serviceFetch";
import { submitApproval } from "@/lib/services/traces";

export async function listPendingApprovals(options?: {
  suppressAlerts?: boolean;
}): Promise<PendingApprovalItem[]> {
  const response = await fetchWithFallback<{ items: PendingApprovalItem[] }>({
    path: "/api/v1/approvals/pending",
    fallbackFactory: () => ({ items: mockPendingApprovals() }),
    warningMessage: "[api] Could not fetch pending approvals, using mock data.",
    timeoutMs: PAGE_FETCH_TIMEOUT_MS,
    timeoutLabel: "listPendingApprovals",
    allowFallback: MAIN_TABS_ALLOW_FALLBACK,
    suppressAlerts: options?.suppressAlerts ?? false,
  });
  return response.items;
}

export async function quickResolvePendingApprovals(
  items: PendingApprovalItem[],
  options?: {
    approver?: string;
    maxItems?: number;
  },
): Promise<number> {
  const approver = options?.approver ?? "analyst1";
  const maxItems = options?.maxItems ?? 25;
  const highPriority = items.filter((item) => {
    const severity = item.severity.toLowerCase();
    return severity === "high" || severity === "critical";
  });
  const targets = highPriority.slice(0, Math.max(0, maxItems));

  if (targets.length === 0) {
    return 0;
  }

  await Promise.all(
    targets.map((item) =>
      submitApproval(item.workflow_id, {
        approver,
        decision: "approved",
        reason: "Quick resolve bulk approval from Action Dock",
      }),
    ),
  );
  return targets.length;
}
