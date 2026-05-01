"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DonutGauge } from "./DonutGauge";
import type { SecurityGaps } from "@/types/telemetry-executive";

interface SecurityGapsPanelProps {
  gaps: SecurityGaps;
  totalSourcetypes: number;
}

const DOMAIN_COLORS = ["#4caf50", "#2196f3", "#ff9800", "#f44336", "#9c27b0"];

export function SecurityGapsPanel({ gaps, totalSourcetypes }: SecurityGapsPanelProps) {
  const domainData = Object.entries(gaps.detection_coverage_by_domain).map(
    ([domain, count], i) => ({
      name: domain,
      value: count,
      color: DOMAIN_COLORS[i % DOMAIN_COLORS.length],
    }),
  );

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-5 mb-6">
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
        Security Coverage Gaps
      </p>
      <p className="text-xs text-on-surface-variant mb-4">
        MITRE ATT&amp;CK coverage gaps, operational detection gaps, and domain distribution.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        {/* MITRE gaps gauge */}
        <div className="flex flex-col items-center gap-2">
          <DonutGauge
            value={gaps.mitre_gap_count}
            maxValue={Math.max(totalSourcetypes, gaps.mitre_gap_count)}
            label="MITRE Gaps"
            color="#f44336"
            format="number"
            size={130}
            tooltipText="Sourcetypes with MITRE ATT&CK coverage < 25% and GB/day > 0.01"
          />
          <p className="text-xs text-on-surface-variant text-center">
            {gaps.mitre_gap_count} sourcetypes with insufficient MITRE coverage
          </p>
        </div>

        {/* Operational gaps gauge */}
        <div className="flex flex-col items-center gap-2">
          <DonutGauge
            value={gaps.operational_gap_count}
            maxValue={Math.max(totalSourcetypes, gaps.operational_gap_count)}
            label="Operational Gaps"
            color="#ff9800"
            format="number"
            size={130}
            tooltipText="Sourcetypes with detection score ≥ 4 but zero active alerts"
          />
          <p className="text-xs text-on-surface-variant text-center">
            {gaps.operational_gap_count} sourcetypes with detection potential but no active alerts
          </p>
        </div>

        {/* Domain coverage pie */}
        <div>
          <p className="text-xs font-semibold text-on-surface mb-2 text-center">
            Domain Distribution
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={domainData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                dataKey="value"
              >
                {domainData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val, name) => [`${Number(val ?? 0)} sources`, String(name ?? "")]}
                contentStyle={{
                  background: "#1e2130",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: "#b0b0b0", fontSize: 10 }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
