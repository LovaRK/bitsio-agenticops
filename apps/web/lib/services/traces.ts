/**
 * Decision trace API service.
 * Handles fetching and managing decision trace data.
 */

import type { ApprovalPayload, ApprovalEvent } from "@/types/api";
import { ACTION_TIMEOUT_MS, DEV_ANALYST_KEY } from "@/lib/config";
import { fetchWithFallback } from "@/lib/services/serviceFetch";

export async function submitApproval(workflowId: string, payload: ApprovalPayload): Promise<void> {
  const headers: Record<string, string> = {
    "x-user-id": payload.approver,
  };

  if (process.env.NODE_ENV !== "production") {
    headers["x-api-key"] = DEV_ANALYST_KEY;
  }

  await fetchWithFallback<void>({
    path: `/api/v1/decision-traces/${workflowId}/approvals`,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
    fallbackFactory: () => undefined,
    warningMessage: `[api] Could not submit approval for ${workflowId} in dev mode.`,
    timeoutMs: ACTION_TIMEOUT_MS,
    timeoutLabel: `submitApproval:${workflowId}`,
  });
}

export async function listApprovals(workflowId: string): Promise<ApprovalEvent[]> {
  const response = await fetchWithFallback<{ items: ApprovalEvent[] }>({
    path: `/api/v1/decision-traces/${workflowId}/approvals`,
    fallbackFactory: () => ({ items: [] }),
    warningMessage: `[api] Could not fetch approvals for ${workflowId}.`,
  });
  return response.items;
}
