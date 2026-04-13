import mockCompletedIncident from "@/lib/mocks/incident_detail_completed.json";
import mockPendingIncident from "@/lib/mocks/incident_detail_pending.json";
import type { DecisionTrace } from "@/types/decision-trace";

const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8001";
const INTERNAL_API_BASE_URL = process.env.INTERNAL_API_BASE_URL ?? PUBLIC_API_BASE_URL;
const API_BASE_URL = typeof window === "undefined" ? INTERNAL_API_BASE_URL : PUBLIC_API_BASE_URL;

const USE_MOCK_FALLBACK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const REQUIRE_LIVE_API = process.env.NEXT_PUBLIC_REQUIRE_LIVE_API === "true";
const DEV_ANALYST_KEY = process.env.NEXT_PUBLIC_DEV_API_KEY_ANALYST ?? "dev-analyst";
const DEV_APPROVER_KEY = process.env.NEXT_PUBLIC_DEV_API_KEY_APPROVER ?? "dev-approver";
const ACTION_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_ACTION_TIMEOUT_MS ?? "3000");

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Request timeout (${label})`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

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
    cache: options.cache ?? "no-store",
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

function canFallback(): boolean {
  return !REQUIRE_LIVE_API && process.env.NODE_ENV !== "production";
}

export interface IncidentSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  timestamp: string;
  source?: string;
  event_count?: number;
}

function pickMockIncident(id: string): DecisionTrace {
  if (id === mockCompletedIncident.incident_id || id === mockCompletedIncident.workflow_id) {
    return mockCompletedIncident as DecisionTrace;
  }
  return mockPendingIncident as DecisionTrace;
}

function mockIncidents(): IncidentSummary[] {
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

export async function listIncidents(): Promise<IncidentSummary[]> {
  if (USE_MOCK_FALLBACK) {
    return mockIncidents();
  }

  try {
    const response = await apiFetch<{ items: IncidentSummary[] }>("/api/v1/incidents");
    return response.items;
  } catch (err) {
    if (!canFallback()) {
      throw err;
    }
    console.warn("[api] Could not fetch incidents, using mock data.", err);
    return mockIncidents();
  }
}

export interface DashboardSummaryResponse {
  stats: {
    active_incidents: number;
    pending_approvals: number;
    avg_confidence: number;
    source_indexes: string[];
    last_updated: string;
  };
  items: IncidentSummary[];
}

async function mockDashboardSummary(): Promise<DashboardSummaryResponse> {
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

export async function getIncidentDetail(id: string): Promise<DecisionTrace> {
  if (USE_MOCK_FALLBACK) {
    return pickMockIncident(id);
  }

  try {
    return await apiFetch<DecisionTrace>(`/api/v1/decision-traces/${id}`);
  } catch (err) {
    if (!canFallback()) {
      throw err;
    }
    console.warn(`[api] Could not fetch trace ${id}, using mock data.`, err);
    return pickMockIncident(id);
  }
}

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

export async function submitApproval(workflowId: string, payload: ApprovalPayload): Promise<void> {
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
      `/api/v1/decision-traces/${workflowId}/approvals`
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

export interface PendingApprovalItem {
  workflow_id: string;
  incident_id: string;
  title: string;
  severity: string;
  confidence: number;
  recommendation: string;
  time_queued: string;
}

function mockPendingApprovals(): PendingApprovalItem[] {
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

export interface MonitoringService {
  name: string;
  status: "Healthy" | "Degraded";
  uptime: string;
  latency_ms: number;
  load_percent: number;
}

export interface MonitoringOverview {
  kpis: {
    global_uptime: string;
    active_nodes: number;
    avg_latency_ms: number;
    system_load_percent: number;
  };
  services: MonitoringService[];
  indexes: {
    name: string;
    size_mb: number;
    event_count: number;
  }[];
  server_info: {
    version: string;
    build: string;
    mode: string;
  };
}

function mockMonitoringOverview(): MonitoringOverview {
  return {
    kpis: {
      global_uptime: "99.90%",
      active_nodes: 3,
      avg_latency_ms: 88,
      system_load_percent: 34,
    },
    services: [
      {
        name: "FastAPI Control Plane",
        status: "Healthy",
        uptime: "99.95%",
        latency_ms: 24,
        load_percent: 20,
      },
    ],
    indexes: [{ name: "tutorial", size_mb: 12, event_count: 1000 }],
    server_info: { version: "mock", build: "mock", mode: "mock" },
  };
}

export async function getMonitoringOverview(): Promise<MonitoringOverview> {
  if (USE_MOCK_FALLBACK) {
    return mockMonitoringOverview();
  }

  try {
    return await apiFetch<MonitoringOverview>("/api/v1/monitoring/overview");
  } catch (err) {
    if (!canFallback()) {
      throw err;
    }
    console.warn("[api] Could not fetch monitoring overview, using mock data.", err);
    return mockMonitoringOverview();
  }
}

export interface SettingsSnapshot {
  platform_name: string;
  environment: string;
  timezone: string;
  splunk: {
    adapter_mode: string;
    live_mode: boolean;
    base_url: string;
    web_base_url: string;
    connected: boolean;
    index_count: number;
  };
  model: {
    provider: string;
    name: string;
    runtime: string;
    base_url: string;
    mock_mode: boolean;
  };
  security: {
    rbac_enabled: boolean;
    rate_limit_per_minute: number;
    oidc_boundary: boolean;
  };
}

export interface RuntimeConfigPayload {
  model_provider: "ollama" | "anthropic" | "stub";
  model_name: string;
  splunk_adapter_mode: "mcp" | "native" | "auto";
  model_mock_mode: boolean;
  splunk_live_mode: boolean;
}

export interface RuntimeConfigResponse {
  updated: boolean;
  model_provider: string;
  model_name: string;
  splunk_adapter_mode: string;
  model_mock_mode: boolean;
  splunk_live_mode: boolean;
}

export interface RuntimeConnectivityResponse {
  model: {
    connected: boolean;
    detail: string;
  };
  splunk: {
    connected: boolean;
    detail: string;
  };
}

function mockSettingsSnapshot(): SettingsSnapshot {
  return {
    platform_name: "BitsIO AgenticOps",
    environment: "local",
    timezone: "UTC",
    splunk: {
      adapter_mode: "mock",
      live_mode: false,
      base_url: "http://localhost:8081",
      web_base_url: "http://localhost:8000",
      connected: true,
      index_count: 1,
    },
    model: {
      provider: "ollama",
      name: "qwen2.5:14b",
      runtime: "local",
      base_url: "http://127.0.0.1:11434",
      mock_mode: true,
    },
    security: {
      rbac_enabled: true,
      rate_limit_per_minute: 100,
      oidc_boundary: true,
    },
  };
}

export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  if (USE_MOCK_FALLBACK) {
    return mockSettingsSnapshot();
  }

  try {
    return await apiFetch<SettingsSnapshot>("/api/v1/settings");
  } catch (err) {
    if (!canFallback()) {
      throw err;
    }
    console.warn("[api] Could not fetch settings snapshot, using mock data.", err);
    return mockSettingsSnapshot();
  }
}

export async function updateRuntimeConfig(
  payload: RuntimeConfigPayload,
): Promise<RuntimeConfigResponse> {
  return apiFetch<RuntimeConfigResponse>("/api/v1/settings/runtime", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function checkRuntimeConnections(): Promise<RuntimeConnectivityResponse> {
  return apiFetch<RuntimeConnectivityResponse>("/api/v1/settings/runtime/check");
}

export interface SupportResourcesResponse {
  categories: {
    title: string;
    icon: string;
    links: {
      label: string;
      href: string;
    }[];
  }[];
  contact: {
    email: string;
    chat: string;
  };
}

function mockSupportResources(): SupportResourcesResponse {
  return {
    categories: [
      {
        title: "Runbooks",
        icon: "rocket_launch",
        links: [{ label: "Live Monitoring View", href: "/monitoring" }],
      },
    ],
    contact: {
      email: "support@bitsio.example",
      chat: "Slack #bitsio-agenticops",
    },
  };
}

export async function getSupportResources(): Promise<SupportResourcesResponse> {
  if (USE_MOCK_FALLBACK) {
    return mockSupportResources();
  }

  try {
    return await apiFetch<SupportResourcesResponse>("/api/v1/support/resources");
  } catch (err) {
    if (!canFallback()) {
      throw err;
    }
    console.warn("[api] Could not fetch support resources, using mock data.", err);
    return mockSupportResources();
  }
}
