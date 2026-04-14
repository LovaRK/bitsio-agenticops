/**
 * Settings API service.
 * Handles fetching and updating runtime configuration.
 */

import type {
  SettingsSnapshot,
  RuntimeConfigPayload,
  RuntimeConfigResponse,
  RuntimeConnectivityResponse,
} from "@/types/api";
import { USE_MOCK_FALLBACK } from "@/lib/config";
import { apiFetch, canFallback } from "@/lib/http";
import { mockSettingsSnapshot } from "@/lib/mocks/settings";

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
