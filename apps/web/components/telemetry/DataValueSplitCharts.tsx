"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DataValueSplit } from "@/types/telemetry-executive";

interface DataValueSplitChartsProps {
  split: DataValueSplit;
}

export function DataValueSplitCharts({ split }: DataValueSplitChartsProps) {
  const volumeData = [
    { name: "Utilized GB", value: split.volume.utilized_gb, color: "#4caf50" },
    { name: "Underutilized GB", value: split.volume.underutilized_gb, color: "#f44336" },
  ];
  const countData = [
    { name: "Utilized Sources", value: split.sourcetype_count.utilized_count, color: "#2196f3" },
    {
      name: "Underutilized Sources",
      value: split.sourcetype_count.underutilized_count,
      color: "#ff9800",
    },
  ];

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-5 mb-6">
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
        Data Value Split
      </p>
      <p className="text-xs text-on-surface-variant mb-4">
        Left: GB volume by utilization status. Right: sourcetype count by utilization status.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Volume split */}
        <div>
          <p className="text-xs font-semibold text-on-surface mb-2 text-center">
            Daily Volume Split ({split.volume.utilized_pct}% utilized)
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={volumeData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
              >
                {volumeData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: number) => [`${val.toFixed(2)} GB`, ""]}
                contentStyle={{
                  background: "#1e2130",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#e0e0e0" }}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: "#b0b0b0", fontSize: 11 }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Count split */}
        <div>
          <p className="text-xs font-semibold text-on-surface mb-2 text-center">
            Sourcetype Count ({split.sourcetype_count.utilized_pct}% utilized)
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={countData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
              >
                {countData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: number) => [`${val} sourcetypes`, ""]}
                contentStyle={{
                  background: "#1e2130",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#e0e0e0" }}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: "#b0b0b0", fontSize: 11 }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
