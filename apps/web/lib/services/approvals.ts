/**
 * Approval API service.
 * Handles fetching and managing approval workflow data.
 */

import type { PendingApprovalItem } from "@/types/api";
import { USE_MOCK_FALLBACK, ACTION_TIMEOUT_MS } from "@/lib/config";
import { apiFetch, withTimeout, canFallback } from "@/lib/http";
import { mockPendingApprovals } from "@/lib/mocks/approvals";
import { submitApproval } from "@/lib/services/traces";

export async function listPendingApprovals(): Promise<PendingApprovalItem[]> {
  if (USE_MOCK_FALLBACK) {
    return mockPendingApprovals();
  }

  try {
    const response = await withTimeout(
      apiFetch<{ items: PendingApprovalItem[] }>("/api/v1/approvals/pending"),
      ACTION_TIMEOUT_MS,
      "listPendingApprovals",
    );
    return response.items;
  } catch (err) {
    if (!canFallback()) {
      throw err;
    }
    console.warn("[api] Could not fetch pending approvals, using mock data.", err);
    return mockPendingApprovals();
  }
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
