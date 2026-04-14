"use client";

export interface ProjectionPoint {
  month: number;
  label: string;
  currentTrajectoryUsd: number;
  optimizedTrajectoryUsd: number;
}

export function StorageSavingsTimeline({ projections }: { projections: ProjectionPoint[] }) {
  const maxCost = Math.max(...projections.map((p) => p.currentTrajectoryUsd));
  const minCost = Math.min(...projections.map((p) => Math.min(p.currentTrajectoryUsd, p.optimizedTrajectoryUsd)));

  const costRange = maxCost - minCost;
  const padding = costRange * 0.1;
  const minY = minCost - padding;
  const maxY = maxCost + padding;
  const yRange = maxY - minY;

  // SVG dimensions
  const svgWidth = 1000;
  const svgHeight = 400;
  const chartLeft = 60;
  const chartTop = 30;
  const chartWidth = svgWidth - chartLeft - 40;
  const chartHeight = svgHeight - chartTop - 60;

  // Calculate points for current trajectory (flat line)
  const currentPoints = projections.map((p, idx) => {
    const x = chartLeft + (idx / (projections.length - 1)) * chartWidth;
    const y = chartTop + chartHeight - ((p.currentTrajectoryUsd - minY) / yRange) * chartHeight;
    return { x, y, ...p };
  });

  // Calculate points for optimized trajectory (curved down)
  const optimizedPoints = projections.map((p, idx) => {
    const x = chartLeft + (idx / (projections.length - 1)) * chartWidth;
    const y = chartTop + chartHeight - ((p.optimizedTrajectoryUsd - minY) / yRange) * chartHeight;
    return { x, y, ...p };
  });

  // Build path for current trajectory
  const currentPath = `M ${currentPoints.map((p) => `${p.x} ${p.y}`).join(" L ")}`;

  // Build smooth path for optimized trajectory using quadratic curves
  let optimizedPath = `M ${optimizedPoints[0].x} ${optimizedPoints[0].y}`;
  for (let i = 1; i < optimizedPoints.length; i++) {
    const prev = optimizedPoints[i - 1];
    const curr = optimizedPoints[i];
    const ctrlX = (prev.x + curr.x) / 2;
    const ctrlY = (prev.y + curr.y) / 2;
    optimizedPath += ` Q ${ctrlX} ${ctrlY} ${curr.x} ${curr.y}`;
  }

  // Calculate savings area between curves
  const totalCurrentCost = projections[projections.length - 1].currentTrajectoryUsd;
  const totalOptimizedCost = projections[projections.length - 1].optimizedTrajectoryUsd;
  const totalSavings = totalCurrentCost - totalOptimizedCost;
  const savingsPercent = ((totalSavings / totalCurrentCost) * 100).toFixed(1);

  const milestones = projections.filter((p) => p.month === 0 || p.month === 3 || p.month === 6 || p.month === 12);

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
          Projected Storage Savings
        </p>
        <p className="text-xs text-on-surface-variant">
          12-month projection with optimization recommendations applied
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest rounded-lg p-3">
          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
            Current Path (12mo)
          </p>
          <p className="text-lg font-black text-on-surface">${(totalCurrentCost / 1000000).toFixed(2)}M</p>
        </div>
        <div className="bg-secondary-container/20 border border-secondary/30 rounded-lg p-3">
          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
            With Optimization (12mo)
          </p>
          <p className="text-lg font-black text-secondary">${(totalOptimizedCost / 1000000).toFixed(2)}M</p>
        </div>
        <div className="bg-tertiary-container/20 border border-tertiary/30 rounded-lg p-3">
          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
            Total Savings
          </p>
          <p className="text-lg font-black text-tertiary">${(totalSavings / 1000000).toFixed(2)}M ({savingsPercent}%)</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-surface-container-lowest rounded-lg p-4 overflow-x-auto">
        <svg className="w-full min-w-min" viewBox={`0 0 ${svgWidth} ${svgHeight}`} aria-hidden="true">
          {/* Grid */}
          {[0, 1, 2, 3, 4].map((i) => {
            const y = chartTop + (i / 4) * chartHeight;
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={chartLeft}
                  y1={y}
                  x2={chartLeft + chartWidth}
                  y2={y}
                  stroke="rgba(140,144,161,0.1)"
                  strokeWidth="1"
                />
                <text
                  x={chartLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="currentColor"
                  className="text-on-surface-variant"
                >
                  ${((maxY - (i / 4) * yRange) / 1000000).toFixed(1)}M
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartTop + chartHeight} stroke="rgba(140,144,161,0.3)" strokeWidth="2" />
          <line x1={chartLeft} y1={chartTop + chartHeight} x2={chartLeft + chartWidth} y2={chartTop + chartHeight} stroke="rgba(140,144,161,0.3)" strokeWidth="2" />

          {/* Savings area (shaded region between curves) */}
          <defs>
            <linearGradient id="savingsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffc107" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ffc107" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Build polygon for area between curves */}
          {optimizedPoints.length > 0 && (
            <polygon
              points={
                optimizedPoints
                  .map((p) => `${p.x},${p.y}`)
                  .concat(
                    currentPoints
                      .slice()
                      .reverse()
                      .map((p) => `${p.x},${p.y}`)
                  )
                  .join(" ")
              }
              fill="url(#savingsGradient)"
            />
          )}

          {/* Current trajectory line */}
          <path
            d={currentPath}
            fill="none"
            stroke="rgba(140,144,161,0.6)"
            strokeWidth="3"
            strokeDasharray="5,5"
            strokeLinecap="round"
          />

          {/* Optimized trajectory line */}
          <path
            d={optimizedPath}
            fill="none"
            stroke="#4db8a8"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Milestone markers */}
          {optimizedPoints.map((point) => {
            const isMilestone = milestones.some((m) => m.month === point.month);
            return (
              <g key={`optimized-${point.month}`}>
                {isMilestone && (
                  <>
                    <circle cx={point.x} cy={point.y} r="5" fill="#4db8a8" />
                    <circle cx={point.x} cy={point.y} r="7" fill="none" stroke="#4db8a8" strokeWidth="2" opacity="0.3" />
                  </>
                )}
              </g>
            );
          })}

          {/* Month labels */}
          {projections.map((p, idx) => {
            const x = chartLeft + (idx / (projections.length - 1)) * chartWidth;
            return (
              <text
                key={`label-${idx}`}
                x={x}
                y={chartTop + chartHeight + 25}
                textAnchor="middle"
                fontSize="11"
                fill="currentColor"
                className="text-on-surface-variant"
              >
                {p.label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 bg-gray-400" style={{ borderTop: "2px dashed rgba(140,144,161,0.6)" }} />
          <span className="text-xs text-on-surface-variant">Current Trajectory</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 bg-secondary" />
          <span className="text-xs text-on-surface-variant">Optimized Trajectory</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-3 rounded" style={{ backgroundColor: "#ffc107", opacity: 0.3 }} />
          <span className="text-xs text-on-surface-variant">Potential Savings</span>
        </div>
      </div>

      {/* Key milestones */}
      <div className="bg-surface-container-lowest rounded-lg p-4">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">
          Key Milestones
        </p>
        <div className="space-y-2">
          {milestones.map((milestone) => {
            const currentCost = milestone.currentTrajectoryUsd;
            const optimizedCost = milestone.optimizedTrajectoryUsd;
            const savings = currentCost - optimizedCost;

            return (
              <div key={milestone.month} className="flex items-center justify-between p-2 bg-surface-container rounded">
                <div>
                  <p className="text-sm font-bold text-on-surface">{milestone.label}</p>
                  <p className="text-xs text-on-surface-variant">
                    Savings: ${(savings / 1000).toFixed(0)}K ({((savings / currentCost) * 100).toFixed(0)}%)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs line-through text-on-surface-variant">${(currentCost / 1000).toFixed(0)}K</p>
                  <p className="text-sm font-bold text-secondary">${(optimizedCost / 1000).toFixed(0)}K</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
