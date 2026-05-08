"use client";

import { DonutGauge } from "./DonutGauge";
import type { ExecutiveKPIs } from "@/types/telemetry-executive";

interface ExecutiveGaugeRowProps {
  kpis: ExecutiveKPIs;
}

export function ExecutiveGaugeRow({ kpis }: ExecutiveGaugeRowProps) {
  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-6 mb-6">
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-4">
        Executive Score Gauges
      </p>
      <div className="flex flex-wrap items-center justify-around gap-6">
        <DonutGauge
          value={kpis.roi_score}
          maxValue={100}
          label="ROI Score"
          color="#4caf50"
          format="number"
          size={140}
          tooltipText="Average composite score across all sourcetypes (0–100)"
        />
        <DonutGauge
          value={kpis.gainscope}
          maxValue={100}
          label="GainScope %"
          color="#2196f3"
          format="percent"
          size={140}
          tooltipText="% of total daily GB volume in Critical + Important tiers"
        />
        <DonutGauge
          value={kpis.low_value_license_spend_usd}
          maxValue={kpis.total_annual_spend_usd}
          label="Low-Value Spend"
          color="#ff9800"
          format="currency"
          size={140}
          tooltipText="Annual license cost of Nice-to-Have + Wasteful sourcetypes"
        />
        <DonutGauge
          value={kpis.storage_savings_potential_usd}
          maxValue={kpis.total_annual_spend_usd}
          label="Savings Potential"
          color="#f44336"
          format="currency"
          size={140}
          tooltipText="Total estimated savings from retention + field + S3 actions"
        />
      </div>
    </div>
  );
}
