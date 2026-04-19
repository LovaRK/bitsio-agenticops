"use client";

export interface ROISource {
  name: string;
  currentSpendUsd: number;
  potentialSavingsUsd: number;
}

function formatCompactUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export function ROIBreakdown({ sources }: { sources: ROISource[] }) {
  const totalCurrentSpend = sources.reduce((sum, s) => sum + s.currentSpendUsd, 0);
  const totalPotentialSavings = sources.reduce((sum, s) => sum + s.potentialSavingsUsd, 0);
  const totalOptimizedCost = totalCurrentSpend - totalPotentialSavings;

  // Sort by spend descending
  const sortedSources = [...sources].sort((a, b) => b.currentSpendUsd - a.currentSpendUsd);

  const barHeight = 200; // px
  const colors = [
    "#4db8a8", // secondary
    "#ffc107", // tertiary
    "#ec407a", // pink
    "#29b6f6", // blue
    "#66bb6a", // green
  ];

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
          Annual Spend & Savings Breakdown
        </p>
        <p className="text-xs text-on-surface-variant">
          Current annual spend vs. potential savings if optimization recommendations are applied
        </p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest rounded-lg p-3">
          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
            Current Annual Spend
          </p>
          <p className="text-lg font-black text-on-surface">{formatCompactUsd(totalCurrentSpend)}</p>
        </div>
        <div className="bg-error-container/20 border border-error/30 rounded-lg p-3">
          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
            Potential Savings
          </p>
          <p className="text-lg font-black text-error">{formatCompactUsd(totalPotentialSavings)}</p>
        </div>
        <div className="bg-secondary-container/20 border border-secondary/30 rounded-lg p-3">
          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
            Optimized Annual Cost
          </p>
          <p className="text-lg font-black text-secondary">{formatCompactUsd(totalOptimizedCost)}</p>
        </div>
      </div>

      {/* Chart area */}
      <div className="bg-surface-container-lowest rounded-lg p-4">
        <div className="flex items-end gap-2 justify-between h-64 mb-4">
          {sortedSources.map((source, idx) => {
            const denominator = totalCurrentSpend > 0 ? totalCurrentSpend : 1;
            const currentHeight = (source.currentSpendUsd / denominator) * barHeight;
            const savingsHeight = (source.potentialSavingsUsd / denominator) * barHeight;
            const color = colors[idx % colors.length];

            return (
              <div key={source.name} className="flex-1 flex flex-col items-center gap-2">
                {/* Stacked bar */}
                <div className="w-full relative flex flex-col-reverse" style={{ height: `${barHeight}px` }}>
                  {/* Current spend (full bar) */}
                  <div
                    style={{
                      backgroundColor: color,
                      height: `${currentHeight}px`,
                      opacity: 0.8,
                    }}
                    className="w-full rounded-t"
                  />
                  {/* Potential savings overlay (lighter) */}
                  {savingsHeight > 0 && (
                    <div
                      style={{
                        backgroundColor: color,
                        height: `${savingsHeight}px`,
                        opacity: 0.3,
                      }}
                      className="w-full"
                    />
                  )}
                </div>

                {/* Source label */}
                <p className="text-[10px] font-bold text-on-surface text-center truncate w-full">
                  {source.name}
                </p>
                <p className="text-[9px] text-on-surface-variant text-center">
                  ${(source.currentSpendUsd / 1000).toFixed(0)}K
                </p>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 justify-center text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: colors[0], opacity: 0.8 }} />
            <span className="text-on-surface-variant">Current Spend</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: colors[0], opacity: 0.3 }} />
            <span className="text-on-surface-variant">Potential Savings</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-surface-container-lowest rounded-lg p-4">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4">
          Optimization Timeline
        </p>

        <div className="space-y-3">
          {[
            { month: 0, label: "Today", percentOptimized: 0 },
            { month: 3, label: "3 Months", percentOptimized: 40 },
            { month: 6, label: "6 Months", percentOptimized: 75 },
            { month: 12, label: "12 Months", percentOptimized: 100 },
          ].map((milestone) => {
            const savingsAtMilestone =
              (milestone.percentOptimized / 100) * totalPotentialSavings;

            return (
              <div key={milestone.month} className="flex items-center gap-3">
                <div className="w-20">
                  <p className="text-xs font-bold text-on-surface">{milestone.label}</p>
                </div>

                {/* Progress bar */}
                <div className="flex-1 relative h-6 bg-surface-container rounded overflow-hidden">
                  <div
                    style={{
                      width: `${milestone.percentOptimized}%`,
                      backgroundColor: milestone.percentOptimized === 0 ? "#8c90a1" : "#4db8a8",
                    }}
                    className="h-full transition-all duration-300 flex items-center justify-end pr-2"
                  >
                    {milestone.percentOptimized > 20 && (
                      <span className="text-[9px] font-bold text-white">
                        {milestone.percentOptimized}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Savings amount */}
                <div className="w-24 text-right">
                  <p className="text-xs font-bold text-on-surface">
                    ${(savingsAtMilestone / 1000).toFixed(0)}K
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Implementation notes */}
      <div className="p-3 bg-secondary-container/10 border border-secondary/20 rounded-lg">
        <p className="text-xs font-bold text-on-surface mb-2">Implementation Timeline</p>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Most sources can begin optimization within 30 days. Full optimization including data archival
          and retention policy updates typically completes within 6 months. Quick wins (field filtering,
          old data retention) can be deployed immediately with minimal operational impact.
        </p>
      </div>
    </div>
  );
}
