/**
 * Settings API service.
 * Handles fetching and updating runtime configuration.
 */

import type {
  SettingsSnapshot,
  RuntimeConfigPayload,
  RuntimeConfigResponse,
  RuntimeConnectivityResponse,
  ModelSettingsPayload,
  ModelSettingsResponse,
} from "@/types/api";
import type { RuntimeSettingsServiceContract } from "@/lib/services/contracts";
import { apiFetch } from "@/lib/http";
import { mockSettingsSnapshot } from "@/lib/mocks/settings";
import { fetchWithFallback } from "@/lib/services/serviceFetch";

export async function getSettingsSnapshot(): Promise<SettingsSnapshot> {
  return fetchWithFallback<SettingsSnapshot>({
    path: "/api/v1/settings",
    fallbackFactory: mockSettingsSnapshot,
    warningMessage: "[api] Could not fetch settings snapshot, using mock data.",
  });
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

export async function updateModelSettings(
  payload: ModelSettingsPayload,
): Promise<ModelSettingsResponse> {
  return apiFetch<ModelSettingsResponse>("/api/v1/settings/model", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export const runtimeSettingsService: RuntimeSettingsServiceContract = {
  getSettingsSnapshot,
  updateRuntimeConfig,
  checkRuntimeConnections,
};
