"use client";

type Props = {
  score: number;
  description: string;
};

function classForScore(score: number): string {
  if (score > 0.7) return "bg-error/20 text-error border-error/40";
  if (score >= 0.3) return "bg-tertiary/20 text-tertiary border-tertiary/40";
  return "bg-secondary/20 text-secondary border-secondary/40";
}

export function AnomalyBadge({ score, description }: Props) {
  const pct = Math.round(score * 100);
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${classForScore(score)}`}
      title={description}
      data-testid="anomaly-badge"
    >
      <span className="material-symbols-outlined text-sm">monitoring</span>
      Anomaly {pct}%
    </span>
  );
}
