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

  // Calculate scales
  const maxDailyGb = Math.max(...sources.map((s) => s.dailyGb), 100);
  const maxCost = Math.max(...sources.map((s) => s.annualCostUsd), 100000);

  const recommendationColors = {
    Keep: "#4db8a8", // secondary
    Optimize: "#ffc107", // tertiary
    Remove: "#f44336", // error
  };

  const recommendationBg = {
    Keep: "bg-secondary-container/20 border-secondary/30",
    Optimize: "bg-tertiary-container/20 border-tertiary/30",
    Remove: "bg-error-container/20 border-error/30",
  };

  // Map data to SVG coordinates
  const bubbles = sources.map((source) => {
    // X: Daily GB (0-100% of width)
    const xPercent = (source.dailyGb / maxDailyGb) * 100;
    const x = 80 + (xPercent / 100) * 880; // 880px width for chart area

    // Y: Utilization score (0-100% of height, inverted so high scores are at top)
    const yPercent = source.utilizationScore;
    const y = 520 - (yPercent / 100) * 420; // 420px height for chart area

    // Size: Based on annual cost
    const sizePercent = (source.annualCostUsd / maxCost) * 100;
    const radius = Math.max(15, Math.min(50, (sizePercent / 100) * 50 + 15)); // 15-65px

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

      <div className="relative bg-surface-container-lowest rounded-lg overflow-hidden border border-outline-variant/10">
        <svg className="w-full" viewBox="0 0 1000 600" aria-hidden="true">
          {/* Grid background */}
          <defs>
            <pattern id="grid" width="100" height="75" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 75" fill="none" stroke="rgba(140,144,161,0.1)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="1000" height="600" fill="url(#grid)" />

          {/* Axes */}
          <line x1="80" y1="520" x2="960" y2="520" stroke="rgba(140,144,161,0.3)" strokeWidth="2" />
          <line x1="80" y1="520" x2="80" y2="100" stroke="rgba(140,144,161,0.3)" strokeWidth="2" />

          {/* Axis labels */}
          <text x="960" y="550" textAnchor="end" fontSize="11" fill="currentColor" className="text-on-surface-variant">
            Daily Volume (GB)
          </text>
          <text
            x="40"
            y="100"
            textAnchor="middle"
            fontSize="11"
            fill="currentColor"
            className="text-on-surface-variant"
            transform="rotate(-90 40 100)"
          >
            Utilization Score
          </text>

          {/* Grid lines */}
          {[100, 200, 300, 400, 500].map((x) => (
            <line key={`vline-${x}`} x1={x + 80} y1="510" x2={x + 80} y2="520" stroke="rgba(140,144,161,0.2)" />
          ))}
          {[0, 25, 50, 75, 100].map((y, i) => (
            <line
              key={`hline-${i}`}
              x1="70"
              y1={520 - (y / 100) * 420}
              x2="80"
              y2={520 - (y / 100) * 420}
              stroke="rgba(140,144,161,0.2)"
            />
          ))}

          {/* Quadrant labels */}
          <text x="200" y="140" fontSize="12" fontWeight="bold" fill="rgba(140,144,161,0.4)" textAnchor="middle">
            High Value
          </text>
          <text x="800" y="140" fontSize="12" fontWeight="bold" fill="rgba(140,144,161,0.4)" textAnchor="middle">
            Optimize
          </text>
          <text x="200" y="480" fontSize="12" fontWeight="bold" fill="rgba(140,144,161,0.4)" textAnchor="middle">
            Consider Removing
          </text>
          <text x="800" y="480" fontSize="12" fontWeight="bold" fill="rgba(140,144,161,0.4)" textAnchor="middle">
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
            {bubbles.find((b) => b.id === hoveredId) && (
              <div className="space-y-2 text-xs">
                <p className="font-bold text-on-surface">
                  {bubbles.find((b) => b.id === hoveredId)?.name}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-on-surface-variant">Daily Ingest</p>
                    <p className="font-bold text-on-surface">
                      {bubbles.find((b) => b.id === hoveredId)?.dailyGb.toFixed(1)} GB
                    </p>
                  </div>
                  <div>
                    <p className="text-on-surface-variant">Utilization</p>
                    <p className="font-bold text-on-surface">
                      {bubbles.find((b) => b.id === hoveredId)?.utilizationScore}%
                    </p>
                  </div>
                  <div>
                    <p className="text-on-surface-variant">Annual Cost</p>
                    <p className="font-bold text-on-surface">
                      ${(
                        (bubbles.find((b) => b.id === hoveredId)?.annualCostUsd || 0) / 1000
                      ).toFixed(1)}K
                    </p>
                  </div>
                  <div>
                    <p className="text-on-surface-variant">Action</p>
                    <p className="font-bold text-on-surface">
                      {bubbles.find((b) => b.id === hoveredId)?.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            )}
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
