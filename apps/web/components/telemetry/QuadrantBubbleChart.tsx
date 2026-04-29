"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { SourcetypeScore, TierName } from "@/types/telemetry-executive";

const TIER_COLORS: Record<TierName, string> = {
  Critical: "#4caf50",
  Important: "#2196f3",
  "Nice-to-Have": "#ff9800",
  Wasteful: "#f44336",
};

interface QuadrantBubbleChartProps {
  scores: SourcetypeScore[];
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: unknown[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const data = (payload[0] as { payload: SourcetypeScore }).payload;
  if (!data) return null;
  return (
    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-high p-3 text-xs shadow-xl">
      <p className="font-bold text-on-surface mb-1">{data.sourcetype}</p>
      <p className="text-on-surface-variant">Index: {data.index}</p>
      <p className="text-on-surface-variant">Tier: <span style={{ color: TIER_COLORS[data.tier] }}>{data.tier}</span></p>
      <p className="text-on-surface-variant">Composite: {data.composite}</p>
      <p className="text-on-surface-variant">Utilization: {data.utilization}</p>
      <p className="text-on-surface-variant">Detection: {data.detection}</p>
      <p className="text-on-surface-variant">GB/day: {data.gb_per_day.toFixed(2)}</p>
      <p className="text-on-surface-variant">Annual cost: ${data.annual_cost_usd.toLocaleString()}</p>
    </div>
  );
}

export function QuadrantBubbleChart({ scores }: QuadrantBubbleChartProps) {
  const MAX_BUBBLE = 30;
  const maxGb = Math.max(...scores.map((s) => s.gb_per_day), 1);

  const data = scores.map((s) => ({
    ...s,
    x: s.utilization,
    y: s.detection,
    z: Math.max(4, (s.gb_per_day / maxGb) * MAX_BUBBLE),
  }));

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-5 mb-6">
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">
        Utilization vs Detection Quadrant
      </p>
      <p className="text-xs text-on-surface-variant mb-4">
        X = Utilization score, Y = Detection score, bubble size = GB/day. Dashed lines at x=50 and
        y=50 divide the quadrants.
      </p>
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            type="number"
            dataKey="x"
            name="Utilization"
            domain={[0, 110]}
            tick={{ fontSize: 10, fill: "#9e9e9e" }}
            label={{ value: "Utilization", position: "insideBottom", offset: -10, fill: "#9e9e9e", fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Detection"
            domain={[0, 110]}
            tick={{ fontSize: 10, fill: "#9e9e9e" }}
            label={{ value: "Detection", angle: -90, position: "insideLeft", fill: "#9e9e9e", fontSize: 11 }}
          />
          <ReferenceLine x={50} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
          <ReferenceLine y={50} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
          <Tooltip content={<CustomTooltip />} />
          {(["Critical", "Important", "Nice-to-Have", "Wasteful"] as TierName[]).map((tier) => {
            const tierData = data.filter((d) => d.tier === tier);
            return tierData.length > 0 ? (
              <Scatter
                key={tier}
                name={tier}
                data={tierData}
                fill={TIER_COLORS[tier]}
                opacity={0.8}
              />
            ) : null;
          })}
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend with all sourcetype names */}
      <div className="mt-4 max-h-32 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {scores.map((s) => (
            <span
              key={s.sourcetype}
              className="text-[10px] px-2 py-0.5 rounded-full border"
              style={{
                borderColor: TIER_COLORS[s.tier],
                color: TIER_COLORS[s.tier],
                background: `${TIER_COLORS[s.tier]}18`,
              }}
            >
              {s.sourcetype}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
