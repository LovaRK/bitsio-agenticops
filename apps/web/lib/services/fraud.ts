import type { FraudOverviewResponse } from "@/types/api";
import { apiFetch, canFallback } from "@/lib/http";
import { mockFraudOverview } from "@/lib/mocks/fraud";

export async function getFraudOverview(mode: "auto" | "seed" | "live" = "auto"): Promise<FraudOverviewResponse> {
  try {
    return await apiFetch<FraudOverviewResponse>(`/api/v1/fraud/overview?mode=${mode}`);
  } catch (error) {
    // In strict live mode, never silently downgrade to local mock data.
    if (mode === "live") {
      throw error;
    }
    if (!canFallback()) {
      throw error;
    }
    console.warn("[api] Could not fetch fraud overview, using mock fallback.", error);
    return mockFraudOverview();
  }
}

export async function getFraudDemo(): Promise<FraudOverviewResponse> {
  try {
    return await apiFetch<FraudOverviewResponse>("/api/v1/fraud/demo");
  } catch (error) {
    if (!canFallback()) {
      throw error;
    }
    return mockFraudOverview();
  }
}
