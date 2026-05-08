const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  return response.json()
}

export const api = {
  // Health
  getHealth: () => fetchApi<{ status: string; service: string; version: string }>('/health'),

  getHealthReady: () => fetchApi<{ status: string; services: Record<string, string> }>('/health/ready'),

  // Telemetry
  getTelemetryMetrics: (params?: { index_name?: string; time_range?: string }) => {
    const query = new URLSearchParams(params as any).toString()
    return fetchApi<any>(`/api/v1/telemetry/metrics${query ? `?${query}` : ''}`)
  },

  analyzeTelemetry: (body: { query: string; time_range?: string }) =>
    fetchApi<any>('/api/v1/telemetry/analyze', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Settings
  getRuntimeSettings: () =>
    fetchApi<{
      provider: string
      model: string
      local_mode: boolean
      inference: string
      cloud_access: string
      telemetry_source: string
    }>('/api/v1/settings/runtime'),

  updateRuntimeSettings: (body: {
    model_provider: string
    model_name: string
    local_mode: boolean
    anthropic_api_key?: string
    openrouter_api_key?: string
  }) =>
    fetchApi<any>('/api/v1/settings/runtime', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  testRuntimeConnection: () =>
    fetchApi<{ status: string; message: string }>('/api/v1/settings/runtime/test', {
      method: 'POST',
    }),
}