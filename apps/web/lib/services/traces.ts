/**
 * Decision trace API service.
 * Handles fetching and managing decision trace data.
 */

import type { ApprovalPayload, ApprovalEvent } from "@/types/api";
import { USE_MOCK_FALLBACK, ACTION_TIMEOUT_MS, DEV_ANALYST_KEY } from "@/lib/config";
import { apiFetch, withTimeout, canFallback } from "@/lib/http";

export async function submitApproval(workflowId: string, payload: ApprovalPayload): Promise<void> {
  const headers: Record<string, string> = {
    "x-user-id": payload.approver,
  };

  if (process.env.NODE_ENV !== "production") {
    headers["x-api-key"] = DEV_ANALYST_KEY;
  }

  if (USE_MOCK_FALLBACK) {
    return;
  }

  try {
    await withTimeout(
      apiFetch<void>(`/api/v1/decision-traces/${workflowId}/approvals`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }),
      ACTION_TIMEOUT_MS,
      `submitApproval:${workflowId}`,
    );
  } catch (err) {
    if (!canFallback()) {
      throw err;
    }
    console.warn(`[api] Could not submit approval for ${workflowId} in dev mode.`, err);
  }
}

export async function listApprovals(workflowId: string): Promise<ApprovalEvent[]> {
  if (USE_MOCK_FALLBACK) {
    return [];
  }

  try {
    const response = await apiFetch<{ items: ApprovalEvent[] }>(
      `/api/v1/decision-traces/${workflowId}/approvals`,
    );
    return response.items;
  } catch (err) {
    if (!canFallback()) {
      throw err;
    }
    console.warn(`[api] Could not fetch approvals for ${workflowId}.`, err);
    return [];
  }
}
