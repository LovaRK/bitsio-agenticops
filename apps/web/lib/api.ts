import type { DecisionTrace } from "@/types/decision-trace";
import mockCompletedIncident from "@/lib/mocks/incident_detail_completed.json";
import mockPendingIncident from "@/lib/mocks/incident_detail_pending.json";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";

// Set NEXT_PUBLIC_USE_MOCK=true to force mock data (useful for Storybook/E2E).
const USE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Incidents ─────────────────────────────────────────────────────────────────

export interface IncidentSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  timestamp: string;
}

function pickMockIncident(id: string): DecisionTrace {
  if (id === mockCompletedIncident.incident_id || id === mockCompletedIncident.workflow_id) {
    return mockCompletedIncident as DecisionTrace;
  }
  return mockPendingIncident as DecisionTrace;
}

export async function listIncidents(): Promise<IncidentSummary[]> {
  if (USE_MOCK_FALLBACK) {
    return [
      {
        id: mockPendingIncident.incident_id,
        title: mockPendingIncident.title,
        severity: mockPendingIncident.severity,
        status: mockPendingIncident.status,
        timestamp: mockPendingIncident.timestamp,
      },
      {
        id: mockCompletedIncident.incident_id,
        title: mockCompletedIncident.title,
        severity: mockCompletedIncident.severity,
        status: mockCompletedIncident.status,
        timestamp: mockCompletedIncident.timestamp,
      },
    ];
  }
  const response = await apiFetch<{ items: IncidentSummary[] }>("/api/v1/incidents");
  return response.items;
}

export async function getIncidentDetail(id: string): Promise<DecisionTrace> {
  if (USE_MOCK_FALLBACK) {
    return pickMockIncident(id);
  }
  try {
    return await apiFetch<DecisionTrace>(`/api/v1/decision-traces/${id}`);
  } catch (err) {
    // Graceful dev fallback — avoids white-screen when API is down locally.
    if (process.env.NODE_ENV === "development") {
      console.warn(`[api] Could not fetch trace ${id}, using mock data.`, err);
      return pickMockIncident(id);
    }
    throw err;
  }
}

// ── Approvals ─────────────────────────────────────────────────────────────────

export interface ApprovalPayload {
  approver: string;
  decision: "approved" | "rejected";
  reason: string;
}

export interface ApprovalEvent {
  event_id: string;
  workflow_id: string;
  approver: string;
  decision: "approved" | "rejected";
  reason: string;
  created_at: string;
}

export async function submitApproval(
  workflowId: string,
  payload: ApprovalPayload
): Promise<void> {
  await apiFetch<void>(`/api/v1/decision-traces/${workflowId}/approvals`, {
    method: "POST",
    headers: { "x-user-id": payload.approver },
    body: JSON.stringify(payload),
  });
}

export async function listApprovals(workflowId: string): Promise<ApprovalEvent[]> {
  return apiFetch<ApprovalEvent[]>(`/api/v1/decision-traces/${workflowId}/approvals`);
}
