"use client";

import type { ExecutiveSummaryResponse } from "@/types/telemetry-executive";

interface InsightsPanelProps {
  data: ExecutiveSummaryResponse | null;
}

function fmtUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export function InsightsPanel({ data }: InsightsPanelProps) {
  if (!data) return null;
  const roi = data.executive_kpis.roi_score;
  const gainscope = data.executive_kpis.gainscope;
  const topDriver = [...data.sourcetype_scores].sort((a, b) => b.annual_cost_usd - a.annual_cost_usd)[0];
  const topWin = data.quick_wins[0];

  const cards = [
    {
      title: "ROI Signal",
      tone: roi > 70 ? "border-l-secondary" : roi >= 40 ? "border-l-amber-400" : "border-l-error",
      body: roi > 70 ? `Strong efficiency signal (${roi.toFixed(1)}).` : roi >= 40 ? `Moderate efficiency signal (${roi.toFixed(1)}).` : `At-risk efficiency signal (${roi.toFixed(1)}).`,
    },
    {
      title: "GainScope",
      tone: gainscope > 60 ? "border-l-secondary" : gainscope >= 35 ? "border-l-amber-400" : "border-l-error",
      body: `${gainscope.toFixed(1)}% of volume is in Critical+Important tiers.`,
    },
    {
      title: "Top Cost Driver",
      tone: "border-l-primary",
      body: topDriver ? `${topDriver.sourcetype} drives ${fmtUsd(topDriver.annual_cost_usd)} annually.` : "No cost driver available.",
    },
    {
      title: "Recommended Action",
      tone: "border-l-secondary",
      body: topWin ? `${topWin.action} (${fmtUsd(topWin.estimated_impact_usd)} impact).` : "No direct high-impact action identified; continue monitoring.",
    },
  ];

  return (
    <div className="mb-6 rounded-xl border border-outline-variant/10 bg-surface-container p-5">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Executive Narrative Insights</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <div key={card.title} className={`rounded-xl border border-outline-variant/10 bg-surface-container p-5 border-l-4 ${card.tone}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-on-surface">{card.title}</p>
            <p className="mt-2 text-sm text-on-surface-variant">{card.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

