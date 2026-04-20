/**
 * Support API service.
 * Handles fetching support resources and documentation.
 */

import type { SupportResourcesResponse } from "@/types/api";
import { mockSupportResources } from "@/lib/mocks/support";
import { fetchWithFallback } from "@/lib/services/serviceFetch";

export async function getSupportResources(): Promise<SupportResourcesResponse> {
  return fetchWithFallback<SupportResourcesResponse>({
    path: "/api/v1/support/resources",
    fallbackFactory: mockSupportResources,
    warningMessage: "[api] Could not fetch support resources, using mock data.",
  });
}
