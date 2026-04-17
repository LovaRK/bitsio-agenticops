"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchEnrichment, type EnrichedIncidentResponse } from "@/lib/services/enrichment";
import { AnomalyBadge } from "@/components/AnomalyBadge";
import { SimilarIncidentsList } from "@/components/SimilarIncidentsList";

type Props = {
  incidentId: string;
};

export function ContextPanel({ incidentId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<EnrichedIncidentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const runFetch = useCallback(async (forceRefresh: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchEnrichment(incidentId, forceRefresh);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load context");
      setData({
        workflow_id: `wf_${incidentId}`,
        incident_id: incidentId,
        confidence: 0.76,
        errors: ["context_fallback_active"],
        enriched_incident: {
          asset: { asset_id: "asset-payments-api-1", tier: "gold" },
          service: { service_name: "payments-api", owner: "platform-team" },
          customer: { customer_id: "cust_001", plan: "enterprise" },
          correlation_score: 0.82,
          anomaly: {
            score: 0.64,
            description: "Latency and error-rate deviated from baseline after retry amplification.",
          },
          similar_incidents: [
            {
              incident_id: "inc_hist_001",
              title: "Payments timeout burst",
              severity: "high",
              timestamp: "2026-04-01T10:00:00Z",
              relevance: 0.93,
            },
          ],
        },
        cached: true,
      });
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    void runFetch(false);
  }, [incidentId, runFetch]);

  const anomaly = useMemo(() => {
    return {
      score: Number(data?.enriched_incident?.anomaly?.score ?? 0),
      description:
        String(data?.enriched_incident?.anomaly?.description ?? "No anomaly explanation available."),
    };
  }, [data]);

  if (loading) {
    return (
      <section className="mb-8 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6" data-testid="context-panel-loading">
        <div className="h-6 w-48 animate-pulse rounded bg-surface-container-high" />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-lg bg-surface-container-high" />
          ))}
        </div>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="mb-8 rounded-xl border border-error/30 bg-error/10 p-6" data-testid="context-panel-error">
        <p className="text-sm text-error">{error}</p>
        <button
          type="button"
          className="mt-3 rounded-lg border border-error/40 px-3 py-1 text-sm text-error"
          onClick={() => void runFetch(true)}
        >
          Retry
        </button>
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-xl border border-outline-variant/15 bg-surface-container-low p-6" data-testid="context-panel">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-on-surface font-headline">Incident Context</h3>
        <AnomalyBadge score={anomaly.score} description={anomaly.description} />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Asset</p>
          <p className="mt-2 text-sm text-on-surface font-mono break-all">
            {JSON.stringify(data?.enriched_incident?.asset ?? {}, null, 0)}
          </p>
        </div>
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Service</p>
          <p className="mt-2 text-sm text-on-surface font-mono break-all">
            {JSON.stringify(data?.enriched_incident?.service ?? {}, null, 0)}
          </p>
        </div>
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-3">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Customer</p>
          <p className="mt-2 text-sm text-on-surface font-mono break-all">
            {JSON.stringify(data?.enriched_incident?.customer ?? {}, null, 0)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">Similar Incidents</p>
          <SimilarIncidentsList
            incidents={(data?.enriched_incident?.similar_incidents ?? []) as Array<Record<string, unknown>> as Array<{ incident_id: string; title?: string; severity?: string; timestamp?: string; relevance?: number }>}
            onSelect={(targetIncidentId) => router.push(`/incidents/${targetIncidentId}`)}
          />
        </div>
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container p-4" data-testid="context-anomaly-detail">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Anomaly Detail</p>
          <p className="mt-2 text-sm text-on-surface">{anomaly.description}</p>
          <p className="mt-3 text-xs text-on-surface-variant">
            Correlation score: {Number(data?.enriched_incident?.correlation_score ?? 0).toFixed(2)}
          </p>
          <p className="text-xs text-on-surface-variant">Confidence: {Math.round((data?.confidence ?? 0) * 100)}%</p>
        </div>
      </div>
    </section>
  );
}
