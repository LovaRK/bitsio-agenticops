"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type {
  TierDistribution,
  ScoreProfilesByTier,
  TopSourcetype,
  TierName,
} from "@/types/telemetry-executive";

const TIER_COLORS: Record<TierName, string> = {
  Critical: "#4caf50",
  Important: "#2196f3",
  "Nice-to-Have": "#ff9800",
  Wasteful: "#f44336",
};

const TIER_NAMES: TierName[] = ["Critical", "Important", "Nice-to-Have", "Wasteful"];

interface TierDistributionSectionProps {
  tierDistribution: TierDistribution;
  scoreProfiles: ScoreProfilesByTier;
  topByVolume: TopSourcetype[];
}

function TinyRadar({
  tier,
  profile,
}: {
  tier: TierName;
  profile: { utilization: number; detection: number; quality: number };
}) {
  const data = [
    { subject: "Util", value: profile.utilization },
    { subject: "Det", value: profile.detection },
    { subject: "Qual", value: profile.quality },
  ];
  return (
    <div className="flex flex-col items-center">
      <p
        className="text-[10px] font-bold mb-1"
        style={{ color: TIER_COLORS[tier] }}
      >
        {tier}
      </p>
      <RadarChart width={110} height={90} data={data}>
        <PolarGrid stroke="rgba(255,255,255,0.1)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 8, fill: "#9e9e9e" }}
        />
        <Radar
          dataKey="value"
          stroke={TIER_COLORS[tier]}
          fill={TIER_COLORS[tier]}
          fillOpacity={0.3}
        />
      </RadarChart>
    </div>
  );
}

export function TierDistributionSection({
  tierDistribution,
  scoreProfiles,
  topByVolume,
}: TierDistributionSectionProps) {
  const pieData = TIER_NAMES.map((t) => ({
    name: t,
    value: tierDistribution[t].count,
    color: TIER_COLORS[t],
  }));

  const barData = topByVolume.map((s) => ({
    name: s.sourcetype.length > 18 ? s.sourcetype.slice(0, 18) + "…" : s.sourcetype,
    gb: s.gb_per_day,
    color: TIER_COLORS[s.tier as TierName] ?? "#9e9e9e",
  }));

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-5 mb-6">
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-4">
        Tier Distribution
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier pie chart */}
        <div>
          <p className="text-xs font-semibold text-on-surface mb-2 text-center">
            By Sourcetype Count
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                {pieData.map((entry) => (
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

        {/* Per-tier radar charts */}
        <div>
          <p className="text-xs font-semibold text-on-surface mb-2 text-center">
            Score Profiles per Tier
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TIER_NAMES.map((t) => (
              <TinyRadar key={t} tier={t} profile={scoreProfiles[t]} />
            ))}
          </div>
        </div>

        {/* Top by volume bar */}
        <div>
          <p className="text-xs font-semibold text-on-surface mb-2 text-center">
            Top Sourcetypes by Volume (GB/day)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9e9e9e" }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 9, fill: "#9e9e9e" }}
                width={100}
              />
              <Tooltip
                formatter={(val) => [`${Number(val ?? 0).toFixed(2)} GB/day`, "Volume"]}
                contentStyle={{
                  background: "#1e2130",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="gb">
                {barData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
