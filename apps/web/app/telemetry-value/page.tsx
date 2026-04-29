"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TelemetryValueLoadingStage } from "@/components/TelemetryValueLoadingStage";
import { getExecutiveSummary } from "@/lib/services/telemetryExecutive";
import type { ExecutiveSummaryResponse, ScoringConfig } from "@/types/telemetry-executive";

// Lazy-loaded section components
import { FilterBar } from "@/components/telemetry/FilterBar";
import { ScoringExplanationBanner } from "@/components/telemetry/ScoringExplanationBanner";
import { ExecutiveGaugeRow } from "@/components/telemetry/ExecutiveGaugeRow";
import { ExecutiveKPICards } from "@/components/telemetry/ExecutiveKPICards";
import { DataValueSplitCharts } from "@/components/telemetry/DataValueSplitCharts";
import { QuickWinsTable } from "@/components/telemetry/QuickWinsTable";
import { TierDistributionSection } from "@/components/telemetry/TierDistributionSection";
import { LicenseAndStaircaseSection } from "@/components/telemetry/LicenseAndStaircaseSection";
import { QuadrantBubbleChart } from "@/components/telemetry/QuadrantBubbleChart";
import { S3CandidatesTable } from "@/components/telemetry/S3CandidatesTable";
import { SecurityGapsPanel } from "@/components/telemetry/SecurityGapsPanel";
import { AverageScoreGauges } from "@/components/telemetry/AverageScoreGauges";
import { FullScoringTable } from "@/components/telemetry/FullScoringTable";

const DEFAULT_CONFIG: Partial<ScoringConfig> = {
  cost_per_gb_year: 10,
  util_weight: 0.35,
  det_weight: 0.40,
  qual_weight: 0.25,
};

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export default function TelemetryValuePage() {
  const [data, setData] = useState<ExecutiveSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<Partial<ScoringConfig>>(DEFAULT_CONFIG);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (cfg: Partial<ScoringConfig>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getExecutiveSummary(cfg);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load executive telemetry data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void fetchData(config);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced re-fetch on config change
  function handleConfigChange(newCfg: Partial<ScoringConfig>) {
    setConfig(newCfg);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchData(newCfg);
    }, 400);
  }

  if (error) {
    return (
      <section className="pt-4 pb-10 px-4 sm:px-6 lg:px-8" data-testid="telemetry-executive-page">
        <FilterBar config={config} onChange={handleConfigChange} />
        <div className="mt-6 rounded-xl border border-error/25 bg-error/10 p-6">
          <h2 className="text-xl font-semibold text-on-surface">
            Executive telemetry data unavailable
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">{error}</p>
          <p className="mt-2 text-xs text-on-surface-variant">
            Connect Splunk/API in Settings and retry. Using fallback data where possible.
          </p>
          <button
            className="mt-4 rounded-lg bg-primary/20 border border-primary/30 text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/30 transition-colors"
            onClick={() => void fetchData(config)}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="pt-0 pb-10 px-4 sm:px-6 lg:px-8"
      data-testid="telemetry-executive-page"
    >
      {/* Section 0: Filter bar (sticky) */}
      <FilterBar config={config} onChange={handleConfigChange} />

      <div className="pt-6">
        {/* Page header */}
        <div className="mb-8">
          <h2 className="text-3xl font-headline font-bold text-on-surface tracking-tight mb-2">
            AI-Powered Telemetry Cost Optimization Platform
          </h2>
          <p className="text-base font-semibold text-secondary mb-2">
            Composite Telemetry Value Scoring
          </p>
          <p className="text-on-surface-variant text-sm max-w-3xl">
            Full sourcetype scoring across Utilization (35%), Detection coverage (40%), and Data
            Quality (25%). Use the filter bar to adjust the cost model and dimension weights.
          </p>
          {data && (
            <div className="mt-2 flex items-center gap-3 text-xs text-on-surface-variant">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold border ${
                  data.trust.data_source === "live"
                    ? "border-secondary/40 text-secondary bg-secondary/10"
                    : "border-outline-variant/40 text-on-surface-variant bg-surface-container"
                }`}
              >
                {data.trust.data_source === "live" ? "Live Splunk data" : "Seed dataset"}
              </span>
              <span>Latency: {data.trust.latency_ms}ms</span>
              <span>Confidence: {Math.round(data.trust.confidence * 100)}%</span>
            </div>
          )}
        </div>

        {loading && !data ? (
          <TelemetryValueLoadingStage />
        ) : (
          <>
            {loading && (
              <div className="mb-4 rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 text-xs text-primary font-semibold">
                Refreshing with new scoring configuration…
              </div>
            )}

            {data && (
              <>
                {/* Section 1: Scoring explanation */}
                <ScoringExplanationBanner />

                {/* Section 2: Executive gauges */}
                <ExecutiveGaugeRow kpis={data.executive_kpis} />

                {/* Section 3: KPI cards */}
                <ExecutiveKPICards kpis={data.executive_kpis} />

                {/* Section 4: Data value split */}
                <DataValueSplitCharts split={data.data_value_split} />

                {/* Section 5: Quick wins */}
                <QuickWinsTable wins={data.quick_wins} />

                {/* Section 6: Tier distribution */}
                <TierDistributionSection
                  tierDistribution={data.tier_distribution}
                  scoreProfiles={data.score_profiles_by_tier}
                  topByVolume={data.top_sourcetypes_by_volume}
                />

                {/* Section 7: License & staircase */}
                <LicenseAndStaircaseSection
                  tierDistribution={data.tier_distribution}
                  staircase={data.savings_staircase}
                />

                {/* Section 8: Quadrant bubble */}
                <QuadrantBubbleChart scores={data.sourcetype_scores} />

                {/* Section 9: S3 candidates */}
                <S3CandidatesTable candidates={data.s3_candidates} />

                {/* Section 10: Security gaps */}
                <SecurityGapsPanel
                  gaps={data.security_gaps}
                  totalSourcetypes={data.executive_kpis.total_sourcetypes_assessed}
                />

                {/* Section 11: Average score gauges */}
                <AverageScoreGauges
                  avgScores={data.avg_scores}
                  resolutionConfidence={data.resolution_confidence}
                />

                {/* Section 12: Full scoring table */}
                <FullScoringTable scores={data.sourcetype_scores} />

                {/* Section 13: Footer CTA */}
                <div className="rounded-xl border border-primary/20 bg-primary-container/10 p-6 space-y-3">
                  <h4 className="font-bold text-on-surface">Key Insights from datasensAI v3</h4>
                  <ul className="text-sm text-on-surface-variant space-y-2 list-disc list-inside">
                    <li>
                      <span className="text-on-surface font-semibold">ROI Score</span>:{" "}
                      {data.executive_kpis.roi_score.toFixed(1)} / 100 — composite average across{" "}
                      {data.executive_kpis.total_sourcetypes_assessed} sourcetypes.
                    </li>
                    <li>
                      <span className="text-on-surface font-semibold">GainScope</span>:{" "}
                      {data.executive_kpis.gainscope.toFixed(1)}% of daily volume is in
                      high-value tiers (Critical + Important).
                    </li>
                    <li>
                      <span className="text-on-surface font-semibold">Top quick win</span>:{" "}
                      {data.quick_wins[0]?.action ?? "n/a"} —{" "}
                      {data.quick_wins[0]
                        ? formatCompact(data.quick_wins[0].estimated_impact_usd) + " estimated impact"
                        : "no wins identified"}
                      .
                    </li>
                    <li>
                      Applying the full 5-stage optimization staircase reduces annual spend from{" "}
                      <span className="text-on-surface font-semibold">
                        {formatCompact(data.savings_staircase[0]?.annual_cost_usd ?? 0)}
                      </span>{" "}
                      to{" "}
                      <span className="text-on-surface font-semibold">
                        {formatCompact(
                          data.savings_staircase[data.savings_staircase.length - 1]?.annual_cost_usd ?? 0,
                        )}
                      </span>
                      .
                    </li>
                  </ul>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
