"use client";

import { SemiCircleGauge } from "./SemiCircleGauge";
import type { AvgScores } from "@/types/telemetry-executive";

interface AverageScoreGaugesProps {
  avgScores: AvgScores;
  resolutionConfidence: number;
}

export function AverageScoreGauges({ avgScores, resolutionConfidence }: AverageScoreGaugesProps) {
  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container p-5 mb-6">
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-4">
        Average Score Gauges
      </p>
      <div className="flex flex-wrap items-center justify-around gap-4">
        <SemiCircleGauge
          value={resolutionConfidence}
          max={100}
          label="Resolution Confidence"
          tooltipText="How safely all S3/remove recommendations can be implemented"
        />
        <SemiCircleGauge
          value={avgScores.utilization}
          max={100}
          label="Avg Utilization"
          tooltipText="Mean utilization score across all sourcetypes"
        />
        <SemiCircleGauge
          value={avgScores.detection}
          max={100}
          label="Avg Detection"
          tooltipText="Mean detection score across all sourcetypes"
        />
        <SemiCircleGauge
          value={avgScores.quality}
          max={100}
          label="Avg Quality"
          tooltipText="Mean quality score (inverse error rate) across all sourcetypes"
        />
      </div>
    </div>
  );
}
