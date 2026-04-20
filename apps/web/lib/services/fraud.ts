import type { FraudOverviewResponse } from "@/types/api";
import type { FraudServiceContract } from "@/lib/services/contracts";
import { mockFraudOverview } from "@/lib/mocks/fraud";
import { fetchWithFallback } from "@/lib/services/serviceFetch";

export async function getFraudOverview(mode: "auto" | "seed" | "live" = "auto"): Promise<FraudOverviewResponse> {
  return fetchWithFallback<FraudOverviewResponse>({
    path: `/api/v1/fraud/overview?mode=${mode}`,
    fallbackFactory: mockFraudOverview,
    warningMessage: "[api] Could not fetch fraud overview, using mock fallback.",
    allowFallback: mode !== "live",
  });
}

export async function getFraudDemo(): Promise<FraudOverviewResponse> {
  return fetchWithFallback<FraudOverviewResponse>({
    path: "/api/v1/fraud/demo",
    fallbackFactory: mockFraudOverview,
    warningMessage: "[api] Could not fetch fraud demo, using mock fallback.",
  });
}

export const fraudService: FraudServiceContract = {
  getFraudOverview,
  getFraudDemo,
};
