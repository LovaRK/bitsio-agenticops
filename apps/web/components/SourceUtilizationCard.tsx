"use client";

export function SourceUtilizationCard({
  sourceIndex,
  utilizationScore,
  valueRating,
  annualSpendUsd,
  potentialSavingsUsd,
  dailyIngestGb,
}: {
  sourceIndex: string;
  utilizationScore: number;
  valueRating: "High" | "Medium" | "Low";
  annualSpendUsd: number;
  potentialSavingsUsd: number;
  dailyIngestGb: number;
}) {
  const valueRatingColors = {
    High: "bg-secondary-container/20 text-secondary border-secondary/30",
    Medium: "bg-tertiary-container/20 text-tertiary border-tertiary/30",
    Low: "bg-error-container/20 text-error border-error/30",
  };

  const gaugeColor = {
    High: "#4db8a8",
    Medium: "#ffc107",
    Low: "#f44336",
  };

  const gaugePath = () => {
    const percent = Math.min(utilizationScore, 100);
    const angle = (percent / 100) * 180; // 0-180 degrees for semicircle
    const radians = (angle * Math.PI) / 180;
    const radius = 45;
    const cx = 60; // center x
    const cy = 60; // center y
    const endX = cx + radius * Math.cos(radians - Math.PI / 2);
    const endY = cy + radius * Math.sin(radians - Math.PI / 2);

    return {
      path: `M ${cx - radius} ${cy} A ${radius} ${radius} 0 ${percent > 50 ? 1 : 0} 1 ${endX} ${endY}`,
      cx,
      cy,
      endX,
      endY,
    };
  };

  const gauge = gaugePath();

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
            Data Source
          </p>
          <p className="text-sm font-bold text-on-surface">{sourceIndex}</p>
        </div>
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full border ${valueRatingColors[valueRating]}`}
        >
          {valueRating} Value
        </span>
      </div>

      {/* Utilization Gauge */}
      <div className="flex items-center gap-6">
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg className="w-full h-full" viewBox="0 0 120 120" aria-hidden="true">
            {/* Background arc */}
            <path
              d={`M ${gauge.cx - 45} ${gauge.cy} A 45 45 0 1 1 ${gauge.cx + 45} ${gauge.cy}`}
              fill="none"
              stroke="rgba(140, 144, 161, 0.2)"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Progress arc */}
            <path
              d={gauge.path}
              fill="none"
              stroke={gaugeColor[valueRating]}
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Center text */}
            <text
              x={gauge.cx}
              y={gauge.cy + 8}
              textAnchor="middle"
              fontSize="24"
              fontWeight="900"
              fill="currentColor"
              className="text-on-surface"
            >
              {utilizationScore}%
            </text>
          </svg>
        </div>

        <div className="space-y-3 flex-1">
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
              Daily Ingest
            </p>
            <p className="text-sm font-bold text-on-surface">{dailyIngestGb.toFixed(1)} GB</p>
          </div>
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
              Annual Cost
            </p>
            <p className="text-sm font-bold text-on-surface">${(annualSpendUsd / 1000).toFixed(1)}K</p>
          </div>
          {potentialSavingsUsd > 0 && (
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
                Potential Savings
              </p>
              <p className="text-sm font-bold text-tertiary">${(potentialSavingsUsd / 1000).toFixed(1)}K</p>
            </div>
          )}
        </div>
      </div>

      {/* Recommendation */}
      <div className="pt-3 border-t border-outline-variant/10">
        <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-2">
          Recommendation
        </p>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          {valueRating === "High"
            ? "Keep this source. High utilization and consistent usage patterns justify retention."
            : valueRating === "Medium"
              ? "Optimize this source. Consider archiving older data or filtering unused fields."
              : "Consider removing or archiving. Low utilization suggests limited business value."}
        </p>
      </div>
    </div>
  );
}
