"use client";

import type { ExecutiveKPIs } from "@/types/telemetry-executive";

interface ExecutiveKPICardsProps {
  kpis: ExecutiveKPIs;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function ExecutiveKPICards({ kpis }: ExecutiveKPICardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-5">
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
          Total Daily Volume
        </p>
        <p className="mt-3 text-3xl font-black text-on-surface">
          {kpis.total_daily_volume_gb.toFixed(1)} GB
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">ingested per day across all sources</p>
      </div>

      <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-5">
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
          Sourcetypes Assessed
        </p>
        <p className="mt-3 text-3xl font-black text-on-surface">
          {kpis.total_sourcetypes_assessed}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">active sourcetypes scored</p>
      </div>

      <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-5">
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">
          Annual License Spend
        </p>
        <p className="mt-3 text-3xl font-black text-error">
          {formatCompact(kpis.total_annual_spend_usd)}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">estimated at $150/GB/year baseline</p>
      </div>
    </div>
  );
}
