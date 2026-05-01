"use client";

import { useQuery } from '@tanstack/react-query';
import type { AgentState } from '@/types/agent';

const AGENT_STATE_TIMEOUT_MS = 5000;

export const buildFallbackAgentState = (workspaceId: string): AgentState => ({
  id: 'agent-telemetry-v1',
  name: 'Telemetry Optimization Agent',
  version: 'v1.3',
  status: 'active',
  mode: 'approval_required',
  autonomyLevel: 'approval_gated',
  currentGoal: 'Optimize telemetry cost without degrading detection coverage',
  lastDecisionAt: new Date().toISOString(),
  confidence: 0.92,
  workspace: {
    id: workspaceId,
    name: workspaceId,
    customerName: 'Demo Customer',
    environment: 'demo',
    splunkInstanceLabel: 'splunk-demo-main',
    complianceTags: ['SOC2'],
  },
});

async function fetchState(workspaceId: string, signal?: AbortSignal): Promise<AgentState> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AGENT_STATE_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch('/api/v1/agent/state', { signal: controller.signal });
    if (!res.ok) throw new Error(`agent-state unavailable for ${workspaceId}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function useAgentState(workspaceId: string) {
  return useQuery({
    queryKey: ['agent-state', workspaceId],
    queryFn: ({ signal }) => fetchState(workspaceId, signal),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: true,
    placeholderData: buildFallbackAgentState(workspaceId),
  });
}
