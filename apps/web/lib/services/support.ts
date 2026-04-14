/**
 * Support API service.
 * Handles fetching support resources and documentation.
 */

import type { SupportResourcesResponse } from "@/types/api";
import { USE_MOCK_FALLBACK } from "@/lib/config";
import { apiFetch, canFallback } from "@/lib/http";
import { mockSupportResources } from "@/lib/mocks/support";

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
