"use client";

import { useState } from "react";

export interface SourceBubble {
  id: string;
  name: string;
  dailyGb: number;
  utilizationScore: number;
  annualCostUsd: number;
  recommendation: "Keep" | "Optimize" | "Remove";
}

export function SourceValueMatrix({ sources }: { sources: SourceBubble[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const chart = {
    width: 1000,
    height: 600,
    left: 90,
    right: 960,
    top: 90,
    bottom: 520,
  };
  const plotWidth = chart.right - chart.left;
  const plotHeight = chart.bottom - chart.top;

  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  // Calculate scales
  const maxDailyGb = Math.max(...sources.map((s) => s.dailyGb), 100);
  const maxCost = Math.max(...sources.map((s) => s.annualCostUsd), 100000);

  const recommendationColors = {
    Keep: "#4db8a8", // secondary
    Optimize: "#ffc107", // tertiary
    Remove: "#f44336", // error
  };

  // Map data to SVG coordinates
  const bubbles = sources.map((source) => {
    // X: Daily GB (0-100% of width)
    const xPercent = (source.dailyGb / maxDailyGb) * 100;
    const rawX = chart.left + (xPercent / 100) * plotWidth;

    // Y: Utilization score (0-100% of height, inverted so high scores are at top)
    const yPercent = source.utilizationScore;
    const rawY = chart.bottom - (yPercent / 100) * plotHeight;

    // Size: Based on annual cost
    const sizePercent = (source.annualCostUsd / maxCost) * 100;
    const radius = Math.max(15, Math.min(50, (sizePercent / 100) * 50 + 15)); // 15-65px

    const x = clamp(rawX, chart.left + radius + 2, chart.right - radius - 2);
    const y = clamp(rawY, chart.top + radius + 2, chart.bottom - radius - 2);

    return {
      ...source,
      x,
      y,
      radius,
    };
  });

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
          Source Value Matrix
        </p>
        <p className="text-xs text-on-surface-variant">
          Position = Value, Size = Cost, Color = Recommendation
        </p>
      </div>

      <div className="relative overflow-x-auto rounded-lg border border-outline-variant/10 bg-surface-container-lowest">
        <svg
          className="block min-w-[900px] w-full"
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          aria-hidden="true"
        >
          {/* Grid background */}
          <defs>
            <pattern id="grid" width="100" height="75" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 75" fill="none" stroke="rgba(140,144,161,0.1)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={chart.width} height={chart.height} fill="url(#grid)" />

          {/* Axes */}
          <line
            x1={chart.left}
            y1={chart.bottom}
            x2={chart.right}
            y2={chart.bottom}
            stroke="rgba(140,144,161,0.3)"
            strokeWidth="2"
          />
          <line
            x1={chart.left}
            y1={chart.bottom}
            x2={chart.left}
            y2={chart.top}
            stroke="rgba(140,144,161,0.3)"
            strokeWidth="2"
          />

          {/* Axis labels */}
          <text
            x={chart.right}
            y={chart.bottom + 30}
            textAnchor="end"
            fontSize="11"
            fill="currentColor"
            className="text-on-surface-variant"
          >
            Daily Volume (GB)
          </text>
          <text
            x={40}
            y={chart.top}
            textAnchor="middle"
            fontSize="11"
            fill="currentColor"
            className="text-on-surface-variant"
            transform={`rotate(-90 40 ${chart.top})`}
          >
            Utilization Score
          </text>

          {/* Ticks + labels */}
          {[0, 20, 40, 60, 80, 100].map((tick) => {
            const x = chart.left + (tick / 100) * plotWidth;
            return (
              <g key={`xtick-${tick}`}>
                <line
                  x1={x}
                  y1={chart.bottom}
                  x2={x}
                  y2={chart.bottom + 8}
                  stroke="rgba(140,144,161,0.25)"
                />
                <text
                  x={x}
                  y={chart.bottom + 22}
                  textAnchor="middle"
                  fontSize="10"
                  fill="currentColor"
                  className="text-on-surface-variant"
                >
                  {Math.round((tick / 100) * maxDailyGb)}
                </text>
              </g>
            );
          })}
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = chart.bottom - (tick / 100) * plotHeight;
            return (
              <g key={`ytick-${tick}`}>
                <line
                  x1={chart.left - 8}
                  y1={y}
                  x2={chart.left}
                  y2={y}
                  stroke="rgba(140,144,161,0.25)"
                />
                <text
                  x={chart.left - 12}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="currentColor"
                  className="text-on-surface-variant"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Quadrant labels */}
          <text x="220" y="140" fontSize="12" fontWeight="bold" fill="rgba(140,144,161,0.4)" textAnchor="middle">
            High Value
          </text>
          <text x="780" y="140" fontSize="12" fontWeight="bold" fill="rgba(140,144,161,0.4)" textAnchor="middle">
            Optimize
          </text>
          <text x="220" y="480" fontSize="12" fontWeight="bold" fill="rgba(140,144,161,0.4)" textAnchor="middle">
            Consider Removing
          </text>
          <text x="780" y="480" fontSize="12" fontWeight="bold" fill="rgba(140,144,161,0.4)" textAnchor="middle">
            Review Usage
          </text>

          {/* Bubbles */}
          {bubbles.map((bubble) => (
            <g key={bubble.id} onMouseEnter={() => setHoveredId(bubble.id)} onMouseLeave={() => setHoveredId(null)}>
              <circle
                cx={bubble.x}
                cy={bubble.y}
                r={bubble.radius}
                fill={recommendationColors[bubble.recommendation]}
                opacity={hoveredId === null || hoveredId === bubble.id ? 0.7 : 0.3}
                className="transition-opacity duration-200 cursor-pointer"
              />
              <circle
                cx={bubble.x}
                cy={bubble.y}
                r={bubble.radius}
                fill="none"
                stroke={recommendationColors[bubble.recommendation]}
                strokeWidth="2"
                opacity={hoveredId === bubble.id ? 1 : 0.4}
                className="transition-opacity duration-200"
              />

              {/* Label - only visible on hover or always for larger bubbles */}
              {(hoveredId === bubble.id || bubble.radius > 30) && (
                <text
                  x={bubble.x}
                  y={bubble.y - 5}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="bold"
                  fill="currentColor"
                  className="text-on-surface pointer-events-none"
                >
                  {bubble.name}
                </text>
              )}
              {(hoveredId === bubble.id || bubble.radius > 30) && (
                <text
                  x={bubble.x}
                  y={bubble.y + 12}
                  textAnchor="middle"
                  fontSize="9"
                  fill="currentColor"
                  className="text-on-surface-variant pointer-events-none"
                >
                  ${(bubble.annualCostUsd / 1000).toFixed(0)}K
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* Tooltip - shown on hover */}
        {hoveredId && (
          <div className="absolute top-4 right-4 bg-surface-container border border-outline-variant/30 rounded-lg p-3 max-w-xs z-10">
            {(() => {
              const hoveredBubble = bubbles.find((b) => b.id === hoveredId);
              if (!hoveredBubble) return null;
              return (
              <div className="space-y-2 text-xs">
                <p className="font-bold text-on-surface">
                  {hoveredBubble.name}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-on-surface-variant">Daily Ingest</p>
                    <p className="font-bold text-on-surface">
                      {hoveredBubble.dailyGb.toFixed(1)} GB
                    </p>
                  </div>
                  <div>
                    <p className="text-on-surface-variant">Utilization</p>
                    <p className="font-bold text-on-surface">
                      {hoveredBubble.utilizationScore}%
                    </p>
                  </div>
                  <div>
                    <p className="text-on-surface-variant">Annual Cost</p>
                    <p className="font-bold text-on-surface">
                      ${(hoveredBubble.annualCostUsd / 1000).toFixed(1)}K
                    </p>
                  </div>
                  <div>
                    <p className="text-on-surface-variant">Action</p>
                    <p className="font-bold text-on-surface">
                      {hoveredBubble.recommendation}
                    </p>
                  </div>
                </div>
              </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4">
        {["Keep", "Optimize", "Remove"].map((rec) => (
          <div key={rec} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: recommendationColors[rec as keyof typeof recommendationColors] }}
            />
            <span className="text-xs text-on-surface-variant">{rec}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
