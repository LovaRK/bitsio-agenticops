"use client";

import { useQuery } from '@tanstack/react-query';
import type { TelemetryMetricsResponse } from '@/types/telemetry';
import { normalizeTelemetryResponse } from '@/lib/telemetry/normalize';

const TELEMETRY_TIMEOUT_MS = 5000;

async function fetchTelemetry(workspaceId: string, signal?: AbortSignal): Promise<TelemetryMetricsResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEMETRY_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch('/api/v1/waste/telemetry/metrics', {
      method: 'GET',
      headers: {
        'x-api-key': 'dev-analyst',
        'x-user-id': `workspace-${workspaceId}`,
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Telemetry fetch failed (${res.status})`);
    return res.json();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function useTelemetryMetrics(workspaceId: string) {
  return useQuery({
    queryKey: ['telemetry-metrics', workspaceId],
    queryFn: ({ signal }) => fetchTelemetry(workspaceId, signal),
    staleTime: 30_000,
    retry: 2,
    refetchOnWindowFocus: true,
    select: normalizeTelemetryResponse,
  });
}
