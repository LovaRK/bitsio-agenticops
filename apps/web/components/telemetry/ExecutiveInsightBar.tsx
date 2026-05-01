"use client";

import type { ExecutiveSummaryResponse } from "@/types/telemetry-executive";

interface ExecutiveInsightBarProps {
  data: ExecutiveSummaryResponse | null;
  isLoading: boolean;
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function riskLevel(mitreGapCount: number): { label: string; color: string } {
  if (mitreGapCount >= 4) return { label: "High", color: "text-error border-error/40 bg-error/10" };
  if (mitreGapCount >= 1) return { label: "Medium", color: "text-amber-400 border-amber-400/40 bg-amber-500/10" };
  return { label: "Low", color: "text-secondary border-secondary/40 bg-secondary/10" };
}

function MetricTooltip({ what, how, why }: { what: string; how: string; why: string }) {
  return (
    <div className="pointer-events-none absolute left-0 top-full z-40 mt-2 hidden w-72 rounded-lg border border-outline-variant/30 bg-surface-container-high p-3 text-xs text-on-surface-variant shadow-xl group-hover:block">
      <p><span className="font-semibold text-on-surface">What:</span> {what}</p>
      <p className="mt-1"><span className="font-semibold text-on-surface">How:</span> {how}</p>
      <p className="mt-1"><span className="font-semibold text-on-surface">Why:</span> {why}</p>
    </div>
  );
}

export function ExecutiveInsightBar({ data, isLoading }: ExecutiveInsightBarProps) {
  if (isLoading || !data) {
    return (
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-outline-variant/20 bg-surface-container p-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-20 animate-pulse rounded-lg bg-surface-container-high" />
        ))}
      </div>
    );
  }

  const annual = data.executive_kpis.total_annual_spend_usd;
  const lowValue = data.executive_kpis.low_value_license_spend_usd;
  const wastePct = annual > 0 ? (lowValue / annual) * 100 : 0;
  const savings = data.executive_kpis.storage_savings_potential_usd;
  const risk = riskLevel(data.security_gaps.mitre_gap_count);

  return (
    <div className="mb-4 rounded-xl border border-outline-variant/20 bg-gradient-to-r from-surface-container-high to-surface-container p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="group relative">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Waste % of Spend</p>
          <p className="text-4xl font-black text-error">{wastePct.toFixed(1)}%</p>
          <MetricTooltip what="Share of annual spend tied to lower-value tiers." how="Low-Value Spend / Total Annual Spend × 100." why="Higher waste indicates immediate cost-optimization opportunity." />
        </div>
        <div className="group relative">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Immediate Savings</p>
          <p className="text-4xl font-black text-secondary">{fmtUsd(savings)}</p>
          <MetricTooltip what="Estimated annual savings from current optimization recommendations." how="Summed projected savings from retention, field, and archive actions." why="Quantifies near-term budget impact." />
        </div>
        <div className="group relative">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Detection Risk</p>
          <p className={`inline-flex rounded-full border px-3 py-1 text-lg font-black ${risk.color}`}>{risk.label}</p>
          <MetricTooltip what="Security posture signal from MITRE coverage gaps." how="Derived from mitre_gap_count: 0 low, 1-3 medium, 4+ high." why="Uncovered detection domains increase incident exposure." />
        </div>
        <div className="group relative">
          <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">ROI Score</p>
          <p className="text-4xl font-black text-on-surface">{data.executive_kpis.roi_score.toFixed(1)}</p>
          <MetricTooltip what="Composite value score across all sourcetypes." how="Average composite where composite = U×weight + D×weight + Q×weight." why="Single executive signal for telemetry efficiency and quality." />
        </div>
      </div>
    </div>
  );
}

