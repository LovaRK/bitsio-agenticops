import { apiFetch } from "@/lib/http";

export type EnrichedIncidentResponse = {
  workflow_id: string;
  incident_id: string;
  confidence: number;
  errors: string[];
  enriched_incident: {
    original_incident?: Record<string, unknown>;
    asset?: Record<string, unknown>;
    service?: Record<string, unknown>;
    customer?: Record<string, unknown>;
    similar_incidents?: Array<Record<string, unknown>>;
    anomaly?: {
      score?: number;
      description?: string;
      baseline?: Record<string, unknown> | null;
    };
    correlation_score?: number;
  };
  cached?: boolean;
};

export async function fetchEnrichment(
  incidentId: string,
  forceRefresh = false,
): Promise<EnrichedIncidentResponse> {
  return apiFetch<EnrichedIncidentResponse>(`/api/v1/incidents/${incidentId}/enrich`, {
    method: "POST",
    body: JSON.stringify({ force_refresh: forceRefresh }),
    suppressAlerts: true,
  });
}
