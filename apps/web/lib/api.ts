import type { DecisionTrace } from "@/types/decision-trace";
import mockCompletedIncident from "@/lib/mocks/incident_detail_completed.json";
import mockPendingIncident from "@/lib/mocks/incident_detail_pending.json";

const PUBLIC_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";
const INTERNAL_API_BASE_URL =
  process.env.INTERNAL_API_BASE_URL ?? PUBLIC_API_BASE_URL;
const API_BASE_URL =
  typeof window === "undefined" ? INTERNAL_API_BASE_URL : PUBLIC_API_BASE_URL;

// Set NEXT_PUBLIC_USE_MOCK=true to force mock data (useful for Storybook/E2E).
const USE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const REQUIRE_LIVE_API = process.env.NEXT_PUBLIC_REQUIRE_LIVE_API === "true";
const DEV_ANALYST_KEY = process.env.NEXT_PUBLIC_DEV_API_KEY_ANALYST ?? "dev-analyst";
const DEV_APPROVER_KEY = process.env.NEXT_PUBLIC_DEV_API_KEY_APPROVER ?? "dev-approver";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (process.env.NODE_ENV !== "production" && !headers.has("x-api-key")) {
    headers.set("x-api-key", DEV_ANALYST_KEY);
  }

  const res = await fetch(url, {
    ...options,
    headers,
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
  const mockIncidents = [
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

  if (USE_MOCK_FALLBACK) {
    return mockIncidents;
  }

  try {
    const response = await apiFetch<{ items: IncidentSummary[] }>("/api/v1/incidents");
    return response.items;
  } catch (err) {
    if (REQUIRE_LIVE_API) {
      throw err;
    }
    if (process.env.NODE_ENV === "development") {
      console.warn("[api] Could not fetch incidents, using mock data.", err);
      return mockIncidents;
    }
    throw err;
  }
}

export async function getIncidentDetail(id: string): Promise<DecisionTrace> {
  if (USE_MOCK_FALLBACK) {
    return pickMockIncident(id);
  }
  try {
    return await apiFetch<DecisionTrace>(`/api/v1/decision-traces/${id}`);
  } catch (err) {
    if (REQUIRE_LIVE_API) {
      throw err;
    }
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
  const headers: Record<string, string> = {
    "x-user-id": payload.approver,
  };

  if (process.env.NODE_ENV !== "production") {
    headers["x-api-key"] = DEV_APPROVER_KEY;
  }

  if (USE_MOCK_FALLBACK) {
    return;
  }

  try {
    await apiFetch<void>(`/api/v1/decision-traces/${workflowId}/approvals`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (REQUIRE_LIVE_API) {
      throw err;
    }
    if (process.env.NODE_ENV === "development") {
      console.warn(`[api] Could not submit approval for ${workflowId} in dev mode.`, err);
      return;
    }
    throw err;
  }
}

export async function listApprovals(workflowId: string): Promise<ApprovalEvent[]> {
  if (USE_MOCK_FALLBACK) {
    return [];
  }
  try {
    const response = await apiFetch<{ items: ApprovalEvent[] }>(
      `/api/v1/decision-traces/${workflowId}/approvals`
    );
    return response.items;
  } catch (err) {
    if (REQUIRE_LIVE_API) {
      throw err;
    }
    if (process.env.NODE_ENV === "development") {
      console.warn(`[api] Could not fetch approvals for ${workflowId}.`, err);
      return [];
    }
    throw err;
  }
}
